"""
Tests for the public visitor voice endpoints (transcribe, tts, voice-characters).

Three properties matter most:
  1. enabled_modules.voice gates everything (UI-only gating leaks paid traffic)
  2. voice/tts can't synthesize using a character belonging to a different tenant
  3. visitor uploads are size + mime restricted before reaching OpenAI

Pattern: each test wires mock_db.execute via side_effect to return a sequence of
SQLAlchemy-shaped Result objects (tenant lookup → optional character lookup).
"""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

from app.models.tenant import Tenant
from app.models.voice_character import VoiceCharacter

SLUG = "demo"


def _result(obj):
    """Build a mock that mimics a SQLAlchemy Result with .scalar_one_or_none()."""
    result = MagicMock()
    result.scalar_one_or_none = MagicMock(return_value=obj)
    return result


def _make_tenant(voice_enabled: bool, tenant_id: uuid.UUID | None = None) -> Tenant:
    return Tenant(
        id=tenant_id or uuid.uuid4(),
        slug=SLUG,
        name="Demo",
        branding={},
        enabled_modules={"voice": voice_enabled},
        operating_hours={},
        contact_info={},
    )


def _make_character(tenant_id: uuid.UUID, hume_voice_id: str = "hume-xyz") -> VoiceCharacter:
    return VoiceCharacter(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        name="Docent",
        description="Warm guide",
        hume_voice_id=hume_voice_id,
        is_default=True,
    )


# ── Voice-disabled gating ────────────────────────────────────────────────────


async def test_transcribe_403_when_voice_disabled(client, mock_db):
    mock_db.execute = AsyncMock(side_effect=[_result(_make_tenant(voice_enabled=False))])
    resp = await client.post(
        f"/api/{SLUG}/voice/transcribe",
        files={"file": ("clip.webm", b"\x00" * 100, "audio/webm")},
    )
    assert resp.status_code == 403


async def test_tts_403_when_voice_disabled(client, mock_db):
    mock_db.execute = AsyncMock(side_effect=[_result(_make_tenant(voice_enabled=False))])
    resp = await client.post(
        f"/api/{SLUG}/voice/tts",
        json={"text": "Hello", "voice_character_id": str(uuid.uuid4())},
    )
    assert resp.status_code == 403


async def test_voice_characters_list_403_when_voice_disabled(client, mock_db):
    mock_db.execute = AsyncMock(side_effect=[_result(_make_tenant(voice_enabled=False))])
    resp = await client.get(f"/api/{SLUG}/voice-characters")
    assert resp.status_code == 403


# ── Validation rejections on transcribe ─────────────────────────────────────


async def test_transcribe_rejects_oversized_file(client, mock_db):
    mock_db.execute = AsyncMock(side_effect=[_result(_make_tenant(voice_enabled=True))])
    oversized = b"\x00" * (1 * 1024 * 1024 + 1)
    resp = await client.post(
        f"/api/{SLUG}/voice/transcribe",
        files={"file": ("big.webm", oversized, "audio/webm")},
    )
    assert resp.status_code == 413


async def test_transcribe_rejects_unsupported_mime(client, mock_db):
    mock_db.execute = AsyncMock(side_effect=[_result(_make_tenant(voice_enabled=True))])
    resp = await client.post(
        f"/api/{SLUG}/voice/transcribe",
        files={"file": ("img.png", b"fake", "image/png")},
    )
    assert resp.status_code == 415


# ── Cross-tenant ownership check on TTS ─────────────────────────────────────


async def test_tts_404_when_voice_character_not_found_for_tenant(client, mock_db):
    """
    Visitor for tenant A submits a voice_character_id that belongs to tenant B.
    The DB query is tenant-scoped so it returns None → 404.
    """
    tenant_a = _make_tenant(voice_enabled=True)
    mock_db.execute = AsyncMock(
        side_effect=[
            _result(tenant_a),     # tenant resolution
            _result(None),         # character lookup misses (different tenant)
        ]
    )
    resp = await client.post(
        f"/api/{SLUG}/voice/tts",
        json={"text": "Hello", "voice_character_id": str(uuid.uuid4())},
    )
    assert resp.status_code == 404


# ── Happy path through TTS (Hume call mocked) ───────────────────────────────


async def test_tts_streams_audio_when_voice_enabled_and_owned(client, mock_db):
    tenant = _make_tenant(voice_enabled=True)
    character = _make_character(tenant.id)
    mock_db.execute = AsyncMock(
        side_effect=[_result(tenant), _result(character)]
    )

    async def fake_stream(_text, _voice):
        yield b"ID3"  # mp3 magic bytes
        yield b"\x00\x00\x00fake-audio-bytes"

    with patch("app.routers.voice.tts_stream", new=fake_stream):
        resp = await client.post(
            f"/api/{SLUG}/voice/tts",
            json={"text": "Welcome", "voice_character_id": str(character.id)},
        )

    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("audio/mpeg")
    assert b"fake-audio-bytes" in resp.content
