"""
ARQ-based document ingest worker.

Pipeline per document:
  1. Download file from Supabase Storage
  2. Extract text (pdfplumber for PDF, python-docx for DOCX, plain text fallback)
  3. Chunk: structure-aware split → ~500-token segments with ~50-token overlap
  4. Embed: OpenAI text-embedding-3-small in batches of 100
  5. Insert DocumentChunk rows with vectors into pgvector
  6. Update Document status to 'ready' (or 'failed' on error)

Enqueue via enqueue_ingest(document_id) from the upload endpoint.
Run the worker with: arq app.workers.ingest.WorkerSettings
"""

import io
import logging
import os

import httpx
import tiktoken
from arq import create_pool
from arq.connections import RedisSettings
from openai import AsyncOpenAI
from sqlalchemy import select, text as sa_text, update
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import settings
from app.models.document import Document

logger = logging.getLogger(__name__)

CHUNK_TARGET_TOKENS = 500
CHUNK_OVERLAP_TOKENS = 50
EMBED_BATCH_SIZE = 100
EMBED_MODEL = "text-embedding-3-small"

# cl100k_base is the tokenizer for GPT-4o and text-embedding-3-small
_tokenizer = tiktoken.get_encoding("cl100k_base")
_openai = AsyncOpenAI(api_key=settings.openai_api_key)


# ── Text extraction ────────────────────────────────────────────────────────────


def _extract_pdf(content: bytes) -> str:
    import pdfplumber

    text_parts = []
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                text_parts.append(text)
    return "\n\n".join(text_parts)


def _extract_docx(content: bytes) -> str:
    from docx import Document as DocxDocument

    doc = DocxDocument(io.BytesIO(content))
    return "\n\n".join(p.text for p in doc.paragraphs if p.text.strip())


def _extract_text(content: bytes, mime_type: str) -> str:
    if mime_type == "application/pdf":
        return _extract_pdf(content)
    if (
        mime_type
        == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ):
        return _extract_docx(content)
    return content.decode("utf-8", errors="replace")


# ── Chunking ───────────────────────────────────────────────────────────────────


def _token_count(text: str) -> int:
    return len(_tokenizer.encode(text))


def _chunk_text(text: str) -> list[str]:
    """
    Structure-aware chunking: split on double newlines (paragraphs/sections),
    then merge small segments and split oversized ones with overlap.
    """
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks: list[str] = []
    current: list[str] = []
    current_tokens = 0

    for para in paragraphs:
        para_tokens = _token_count(para)

        # Paragraph alone exceeds target — split it by sentences with overlap
        if para_tokens > CHUNK_TARGET_TOKENS:
            if current:
                chunks.append("\n\n".join(current))
                current = []
                current_tokens = 0
            chunks.extend(_split_large_paragraph(para))
            continue

        if current_tokens + para_tokens > CHUNK_TARGET_TOKENS:
            chunks.append("\n\n".join(current))
            # Keep last paragraph as overlap seed for next chunk
            overlap_seed = current[-1] if current else ""
            overlap_tokens = _token_count(overlap_seed)
            if overlap_tokens <= CHUNK_OVERLAP_TOKENS:
                current = [overlap_seed, para]
                current_tokens = overlap_tokens + para_tokens
            else:
                current = [para]
                current_tokens = para_tokens
        else:
            current.append(para)
            current_tokens += para_tokens

    if current:
        chunks.append("\n\n".join(current))

    return chunks


def _split_large_paragraph(text: str) -> list[str]:
    """Token-based sliding window for paragraphs that exceed CHUNK_TARGET_TOKENS."""
    tokens = _tokenizer.encode(text)
    chunks = []
    start = 0
    while start < len(tokens):
        end = min(start + CHUNK_TARGET_TOKENS, len(tokens))
        chunks.append(_tokenizer.decode(tokens[start:end]))
        start += CHUNK_TARGET_TOKENS - CHUNK_OVERLAP_TOKENS
    return chunks


# ── Embedding ──────────────────────────────────────────────────────────────────


async def _embed_batches(texts: list[str]) -> list[list[float]]:
    """Embed texts in batches; returns one vector per text."""
    all_vectors: list[list[float]] = []
    for i in range(0, len(texts), EMBED_BATCH_SIZE):
        batch = texts[i : i + EMBED_BATCH_SIZE]
        response = await _openai.embeddings.create(model=EMBED_MODEL, input=batch)
        all_vectors.extend([item.embedding for item in response.data])
    return all_vectors


# ── ARQ task ───────────────────────────────────────────────────────────────────


async def ingest_document(ctx: dict, document_id: str) -> None:
    """ARQ task: full ingest pipeline for a single document."""
    session_factory = ctx["session_factory"]

    try:
        # Per-job session — a failed job can't poison sessions used by later jobs,
        # and a dropped Supabase connection doesn't persist across runs.
        async with session_factory() as db_session:
            result = await db_session.execute(
                select(Document).where(Document.id == document_id)
            )
            document = result.scalar_one_or_none()
            if document is None:
                logger.error("ingest_document: document %s not found", document_id)
                return

            await db_session.execute(
                update(Document)
                .where(Document.id == document_id)
                .values(status="processing")
            )
            await db_session.commit()

            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"{settings.supabase_url}/storage/v1/object/tenant-assets/{document.storage_path}",
                    headers={
                        "Authorization": f"Bearer {settings.supabase_service_role_key}"
                    },
                )
                resp.raise_for_status()
                content = resp.content

            text = _extract_text(content, document.mime_type or "text/plain")
            if not text.strip():
                raise ValueError("No text could be extracted from the document")

            total_tokens = _token_count(text)
            chunks = _chunk_text(text)
            vectors = await _embed_batches(chunks)

            # Raw SQL — pgvector requires CAST(:embedding AS vector) with a "[...]" literal
            for idx, (chunk_text, vector) in enumerate(zip(chunks, vectors)):
                chunk_tokens = _token_count(chunk_text)
                vector_str = "[" + ",".join(str(v) for v in vector) + "]"
                await db_session.execute(
                    sa_text(
                        """
                        INSERT INTO document_chunks
                            (tenant_id, document_id, content, embedding, chunk_index, token_count)
                        VALUES
                            (:tenant_id, :document_id, :content, CAST(:embedding AS vector), :chunk_index, :token_count)
                        """
                    ),
                    {
                        "tenant_id": str(document.tenant_id),
                        "document_id": document_id,
                        "content": chunk_text,
                        "embedding": vector_str,
                        "chunk_index": idx,
                        "token_count": chunk_tokens,
                    },
                )

            await db_session.execute(
                update(Document)
                .where(Document.id == document_id)
                .values(
                    status="ready",
                    token_count=total_tokens,
                    chunk_count=len(chunks),
                    error_message=None,
                )
            )
            await db_session.commit()
            logger.info(
                "ingest_document: %s complete — %d chunks", document_id, len(chunks)
            )

    except Exception as exc:
        logger.exception("ingest_document: %s failed", document_id)
        # Fresh session — the primary session may be in an invalid state.
        try:
            async with session_factory() as fail_session:
                await fail_session.execute(
                    update(Document)
                    .where(Document.id == document_id)
                    .values(status="failed", error_message=str(exc))
                )
                await fail_session.commit()
        except Exception:
            logger.exception(
                "ingest_document: %s — could not record failure", document_id
            )


# ── ARQ worker settings ────────────────────────────────────────────────────────


async def startup(ctx: dict) -> None:
    # Worker runs as a separate process — can't share the FastAPI app's DB session.
    # Store the factory, not a session: each job opens its own so one failure
    # can't poison the shared state for subsequent jobs.
    engine = create_async_engine(settings.database_url, echo=False)
    ctx["engine"] = engine
    ctx["session_factory"] = async_sessionmaker(engine, expire_on_commit=False)


async def shutdown(ctx: dict) -> None:
    await ctx["engine"].dispose()


class WorkerSettings:
    functions = [ingest_document]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = RedisSettings.from_dsn(
        os.environ.get("REDIS_URL", "redis://localhost:6379")
    )
    max_tries = 3


# ── Enqueue helper (called from upload endpoint) ───────────────────────────────


async def enqueue_ingest(document_id: str) -> None:
    redis = await create_pool(
        RedisSettings.from_dsn(os.environ.get("REDIS_URL", "redis://localhost:6379"))
    )
    await redis.enqueue_job("ingest_document", document_id)
    await redis.aclose()
