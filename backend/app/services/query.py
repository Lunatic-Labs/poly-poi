"""
RAG query service for the visitor chatbot.

Public interface:
    query(tenant, message, session_id, db) -> AsyncGenerator[str, None]

Yields text tokens to stream to the client.

Flow:
  1. Structured intent check (keyword/regex, no AI) — returns a direct answer if matched.
  2. Vector retrieval — cosine similarity top-5 chunks filtered by tenant_id.
  3. Prompt assembly — builds GPT-4o messages with retrieved context.
  4. Stream GPT-4o response token by token.
  5. Post-stream: detect unanswered patterns and log to unanswered_questions.

Token budget enforcement is deferred to Phase 6.

Internal helpers are module-private (leading underscore) and should not be imported
directly. Keep the public interface narrow: only `query` is exported.
"""

import logging
import re
import uuid
from typing import AsyncGenerator, Optional

from openai import AsyncOpenAI
from sqlalchemy import select
from sqlalchemy import text as sa_text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.amenity import Amenity
from app.models.stop import Stop
from app.models.tenant import Tenant

logger = logging.getLogger(__name__)

_openai = AsyncOpenAI(api_key=settings.openai_api_key)

EMBED_MODEL = "text-embedding-3-small"
CHAT_MODEL = "gpt-4o"
RETRIEVAL_TOP_K = 5

# ── Intent patterns ────────────────────────────────────────────────────────────

_HOURS = re.compile(
    r"\b(hours?|open|close|closing|when does|what time|schedule|admission)\b", re.I
)
_CONTACT = re.compile(
    r"\b(contact|phone|call|email|address|website|reach you|number)\b", re.I
)
_EMERGENCY = re.compile(
    r"\b(emergency|first aid|medical|hurt|injured|sick|911)\b", re.I
)
_RESTROOM = re.compile(r"\b(restroom|bathroom|toilet|wc|washroom|lavatory)\b", re.I)
_FOOD = re.compile(
    r"\b(food|eat|eating|restaurant|cafe|cafeteria|snack|coffee|drink|hungry|lunch|dinner|breakfast)\b",
    re.I,
)
_PARKING = re.compile(
    r"\b(parking|park my car|parking lot|parking garage|where (do i|can i) park)\b",
    re.I,
)
_ACCESSIBLE = re.compile(
    r"\b(accessible|accessibility|wheelchair|handicap|ada|disabled|disability|mobility)\b",
    re.I,
)

# Ordered: emergency before amenity types so urgent queries get the right handler
_AMENITY_INTENTS: list[tuple[re.Pattern, str]] = [
    (_EMERGENCY, "emergency"),
    (_RESTROOM, "restroom"),
    (_FOOD, "food"),
    (_PARKING, "parking"),
]

# Phrases GPT-4o naturally uses when it cannot answer from context
_UNANSWERED = re.compile(
    r"\b(I don'?t have|I'?m not sure|I cannot find|I don'?t know|"
    r"not covered|unable to find|not available in my|no information about|"
    r"don'?t have specific|I'?m unable to|cannot provide that|no details about)\b",
    re.I,
)

_TONE_SNIPPETS: dict[str, str] = {
    "friendly": "Be warm, approachable, and conversational.",
    "professional": "Be knowledgeable, precise, and courteous.",
    "enthusiastic": "Be energetic, passionate, and enthusiastic about the location!",
}


# ── Structured handlers ────────────────────────────────────────────────────────


def _format_hours(tenant: Tenant) -> str:
    hours = tenant.operating_hours or {}
    if not hours:
        return (
            "Operating hours aren't listed here yet. "
            "Please check with staff for the most up-to-date information."
        )
    lines = []
    for day, times in hours.items():
        if isinstance(times, dict):
            open_t = times.get("open", "")
            close_t = times.get("close", "")
            lines.append(
                f"{day.capitalize()}: {open_t} – {close_t}"
                if open_t and close_t
                else f"{day.capitalize()}: Closed"
            )
        else:
            lines.append(f"{day.capitalize()}: {times}")
    return "Here are the operating hours:\n" + "\n".join(lines)


def _format_contact(tenant: Tenant) -> str:
    info = tenant.contact_info or {}
    parts = []
    if phone := info.get("phone"):
        parts.append(f"Phone: {phone}")
    if email := info.get("email"):
        parts.append(f"Email: {email}")
    if address := info.get("address"):
        parts.append(f"Address: {address}")
    if website := info.get("website"):
        parts.append(f"Website: {website}")
    return (
        "Here's how to reach us:\n" + "\n".join(parts)
        if parts
        else "Contact information isn't available at the moment."
    )


async def _format_amenities(
    amenity_type: str, tenant_id: uuid.UUID, db: AsyncSession
) -> str:
    result = await db.execute(
        select(Amenity).where(
            Amenity.tenant_id == tenant_id,
            Amenity.type == amenity_type,
        )
    )
    amenities = result.scalars().all()
    if not amenities:
        return (
            f"No {amenity_type.replace('_', ' ')} facilities are listed at this time."
        )
    label = amenity_type.capitalize()
    lines = [f"{label} locations:"]
    for a in amenities:
        line = f"• {a.name}"
        if a.notes:
            line += f" — {a.notes}"
        lines.append(line)
    return "\n".join(lines)


async def _format_accessible_stops(tenant_id: uuid.UUID, db: AsyncSession) -> str:
    result = await db.execute(
        select(Stop).where(Stop.tenant_id == tenant_id, Stop.is_accessible.is_(True))
    )
    stops = result.scalars().all()
    if not stops:
        return (
            "Accessibility information for specific stops hasn't been added yet. "
            "Please contact staff for assistance with accessibility needs."
        )
    lines = ["Here are the accessible stops:"]
    for s in stops:
        line = f"• {s.name}"
        if s.description:
            line += f" — {s.description[:120]}"
        lines.append(line)
    return "\n".join(lines)


async def _classify_and_handle_structured(
    message: str, tenant: Tenant, db: AsyncSession
) -> Optional[str]:
    """
    Return a direct string answer for structured intents, or None to fall through to RAG.
    Checks: hours → contact → accessibility → emergency → restroom → food → parking.
    """
    if _HOURS.search(message):
        return _format_hours(tenant)
    if _CONTACT.search(message):
        return _format_contact(tenant)
    if _ACCESSIBLE.search(message):
        return await _format_accessible_stops(tenant.id, db)

    for pattern, amenity_type in _AMENITY_INTENTS:
        if pattern.search(message):
            if amenity_type == "emergency":
                emergency_phone = (tenant.contact_info or {}).get("emergency_phone")
                amenity_answer = await _format_amenities("emergency", tenant.id, db)
                return (
                    f"For emergencies, call {emergency_phone}.\n\n{amenity_answer}"
                    if emergency_phone
                    else amenity_answer
                )
            return await _format_amenities(amenity_type, tenant.id, db)

    return None


# ── RAG helpers ────────────────────────────────────────────────────────────────


async def _embed(text: str) -> list[float]:
    response = await _openai.embeddings.create(model=EMBED_MODEL, input=text)
    return response.data[0].embedding


async def _retrieve(message: str, tenant_id: uuid.UUID, db: AsyncSession) -> list[str]:
    """Cosine similarity search against document_chunks, filtered by tenant."""
    vector = await _embed(message)
    vector_str = "[" + ",".join(str(v) for v in vector) + "]"
    result = await db.execute(
        sa_text("""
            SELECT content
            FROM document_chunks
            WHERE tenant_id = :tenant_id
            ORDER BY embedding <=> CAST(:embedding AS vector)
            LIMIT :k
        """),
        {"tenant_id": str(tenant_id), "embedding": vector_str, "k": RETRIEVAL_TOP_K},
    )
    return [row[0] for row in result.fetchall()]


def _assemble_prompt(
    tenant: Tenant, message: str, chunks: list[str], history: list
) -> list[dict]:
    tone = (tenant.branding or {}).get("tone_preset", "friendly")
    tone_instruction = _TONE_SNIPPETS.get(tone, _TONE_SNIPPETS["friendly"])
    context_block = (
        "\n\n---\n\n".join(chunks)
        if chunks
        else "No specific documentation is available for this query."
    )
    system = (
        f"You are a knowledgeable tour guide for {tenant.name}. {tone_instruction}\n\n"
        "Answer visitor questions using the provided context. "
        "If the context doesn't contain enough information to answer, say so honestly "
        "and suggest the visitor ask a staff member for help.\n\n"
        "Context from our knowledge base:\n"
        f"{context_block}"
    )
    messages = [{"role": "system", "content": system}]

    # Conversation history (already validated: only user/assistant roles)
    for msg in history:
        messages.append({"role": msg.role, "content": msg.content})

    messages.append({"role": "user", "content": message})
    return messages


async def _stream_openai(messages: list[dict]) -> AsyncGenerator[str, None]:
    stream = await _openai.chat.completions.create(
        model=CHAT_MODEL,
        messages=messages,
        stream=True,
        temperature=0.7,
        max_tokens=600,
    )
    async for chunk in stream:
        token = chunk.choices[0].delta.content
        if token:
            yield token


async def _log_unanswered(message: str, tenant_id: uuid.UUID, db: AsyncSession) -> None:
    try:
        await db.execute(
            sa_text(
                "INSERT INTO unanswered_questions (tenant_id, question) "
                "VALUES (:tenant_id, :question)"
            ),
            {"tenant_id": str(tenant_id), "question": message},
        )
        await db.commit()
    except Exception:
        logger.exception("Failed to log unanswered question for tenant %s", tenant_id)


# ── Public interface ───────────────────────────────────────────────────────────


async def query(
    tenant: Tenant,
    message: str,
    session_id: str,
    history: list,
    db: AsyncSession,
) -> AsyncGenerator[str, None]:
    """
    Main entry point for visitor chat. Yields text tokens for the caller to stream.

    Structured queries (hours, amenities, contact) are answered directly from DB data
    without an AI call. All other queries go through the RAG pipeline.

    Token budget enforcement is deferred to Phase 6.
    """
    structured = await _classify_and_handle_structured(message, tenant, db)
    if structured is not None:
        yield structured
        return

    try:
        chunks = await _retrieve(message, tenant.id, db)
    except Exception:
        logger.exception("Vector retrieval failed for tenant %s", tenant.id)
        chunks = []

    messages = _assemble_prompt(tenant, message, chunks, history)

    accumulated: list[str] = []
    async for token in _stream_openai(messages):
        accumulated.append(token)
        yield token

    full_response = "".join(accumulated)
    if _UNANSWERED.search(full_response):
        await _log_unanswered(message, tenant.id, db)
