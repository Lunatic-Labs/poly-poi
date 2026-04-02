"""
Tests for pure functions in app.workers.ingest.

Import note: loading this module triggers two module-level side effects in ingest.py:
  - tiktoken.get_encoding("cl100k_base") — downloads encoding on first run, cached thereafter
  - AsyncOpenAI(api_key=...) — reads settings.openai_api_key (dummy value set in conftest.py)
Neither requires network access after the first tiktoken cache population.
"""
from unittest.mock import patch

from app.workers.ingest import (
    CHUNK_TARGET_TOKENS,
    _chunk_text,
    _extract_text,
    _split_large_paragraph,
    _token_count,
)


# ── _split_large_paragraph ────────────────────────────────────────────────────


def test_split_large_paragraph_respects_target_and_overlaps():
    long_text = "word " * 600  # well over 500 tokens
    chunks = _split_large_paragraph(long_text)

    assert len(chunks) > 1
    for chunk in chunks:
        assert _token_count(chunk) <= CHUNK_TARGET_TOKENS

    # Sliding window produces overlap: last words of chunk N appear in chunk N+1
    end_of_first = chunks[0].split()[-5:]
    start_of_second = chunks[1].split()[:10]
    assert any(w in start_of_second for w in end_of_first)


# ── _chunk_text ───────────────────────────────────────────────────────────────


def test_chunk_text_splits_many_paragraphs():
    # ~20 tokens per paragraph × 30 paragraphs ≈ 600 tokens total → must produce > 1 chunk
    para = "This is a sentence with roughly twenty tokens in it, give or take a few."
    text = "\n\n".join([para] * 30)
    chunks = _chunk_text(text)
    assert len(chunks) > 1


def test_chunk_text_oversized_paragraph_produces_bounded_chunks():
    # A single paragraph > 500 tokens must route through _split_large_paragraph
    long_para = "token " * 600
    chunks = _chunk_text(long_para)
    assert len(chunks) > 1
    for chunk in chunks:
        assert _token_count(chunk) <= CHUNK_TARGET_TOKENS


# ── _extract_text ─────────────────────────────────────────────────────────────


def test_extract_text_plain_and_fallback():
    assert _extract_text(b"Hello", "text/plain") == "Hello"
    assert _extract_text(b"fallback", "application/octet-stream") == "fallback"


def test_extract_text_dispatches_to_pdf():
    with patch("app.workers.ingest._extract_pdf", return_value="pdf text") as mock:
        result = _extract_text(b"...", "application/pdf")
    mock.assert_called_once_with(b"...")
    assert result == "pdf text"


def test_extract_text_dispatches_to_docx():
    docx_mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    with patch("app.workers.ingest._extract_docx", return_value="docx text") as mock:
        result = _extract_text(b"...", docx_mime)
    mock.assert_called_once_with(b"...")
    assert result == "docx text"
