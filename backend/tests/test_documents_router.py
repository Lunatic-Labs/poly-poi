"""
Tests for POST /api/admin/documents.

Two httpx clients coexist here without conflict:
  - Test client uses ASGITransport (in-process, not intercepted by pytest-httpx)
  - Handler opens httpx.AsyncClient() for Supabase Storage — this IS intercepted by httpx_mock

enqueue_ingest is patched at its import location in the router module, not at the source,
because documents.py binds the name into its own namespace at import time.
"""
from unittest.mock import AsyncMock, patch

ENDPOINT = "/api/admin/documents"
PDF_MIME = "application/pdf"


# ── Validation rejections ─────────────────────────────────────────────────────


async def test_rejects_oversized_file(client):
    oversized = b"x" * (20 * 1024 * 1024 + 1)  # 20 MB + 1 byte
    response = await client.post(
        ENDPOINT,
        files={"file": ("big.pdf", oversized, PDF_MIME)},
    )
    assert response.status_code == 413
    assert "20 MB" in response.json()["detail"]


async def test_rejects_unsupported_mime(client):
    response = await client.post(
        ENDPOINT,
        files={"file": ("photo.png", b"fake-image", "image/png")},
    )
    assert response.status_code == 415
    assert "Unsupported" in response.json()["detail"]


# ── Happy path ────────────────────────────────────────────────────────────────


async def test_upload_creates_pending_document(client, httpx_mock):
    httpx_mock.add_response(method="PUT", status_code=200, json={})

    with patch("app.routers.documents.enqueue_ingest", new=AsyncMock()) as mock_enqueue:
        response = await client.post(
            ENDPOINT,
            files={"file": ("guide.pdf", b"fake-pdf-content", PDF_MIME)},
        )

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "pending"
    assert body["filename"] == "guide.pdf"
    assert body["mime_type"] == PDF_MIME
    mock_enqueue.assert_called_once()


# ── Enqueue failure tolerance ─────────────────────────────────────────────────


async def test_enqueue_failure_does_not_fail_request(client, httpx_mock):
    """
    If Redis/ARQ is unavailable the endpoint must still return 201.
    The try/except in upload_document swallows enqueue errors by design.
    """
    httpx_mock.add_response(method="PUT", status_code=200, json={})

    with patch(
        "app.routers.documents.enqueue_ingest",
        new=AsyncMock(side_effect=Exception("Redis unavailable")),
    ):
        response = await client.post(
            ENDPOINT,
            files={"file": ("guide.pdf", b"fake-pdf-content", PDF_MIME)},
        )

    assert response.status_code == 201
    assert response.json()["status"] == "pending"
