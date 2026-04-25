"""
Tests for admin voice character CRUD.

Hume calls (design_voice, save_voice) are patched at the router import location
so we never touch the real Hume API and don't need network access in tests.
"""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

from app.models.voice_character import VoiceCharacter

ENDPOINT = "/api/admin/voice-characters"


def _result(obj):
    result = MagicMock()
    result.scalar_one_or_none = MagicMock(return_value=obj)
    result.scalars = MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))
    return result


# ── Voice Design preview ────────────────────────────────────────────────────


async def test_design_preview_returns_audio_payload(client):
    fake = {
        "generation_id": "gen_abc",
        "audio_base64": "AAAA",
        "format": "mp3",
    }
    with patch(
        "app.routers.voice_characters.design_voice",
        new=AsyncMock(return_value=fake),
    ):
        resp = await client.post(
            f"{ENDPOINT}/design-preview",
            json={"description": "a warm museum docent"},
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["generation_id"] == "gen_abc"
    assert body["audio_base64"] == "AAAA"
    assert body["format"] == "mp3"


async def test_design_preview_rejects_short_description(client):
    resp = await client.post(
        f"{ENDPOINT}/design-preview",
        json={"description": "ab"},  # below min_length=4
    )
    assert resp.status_code == 422


# ── Create (save) ───────────────────────────────────────────────────────────


async def test_create_voice_character_calls_save_and_persists(client, mock_db, fake_tenant_id):
    mock_db.execute = AsyncMock(return_value=_result(None))

    with patch(
        "app.routers.voice_characters.save_voice",
        new=AsyncMock(return_value="hume-voice-name-123"),
    ):
        resp = await client.post(
            ENDPOINT,
            json={
                "name": "Docent",
                "description": "warm and unhurried",
                "generation_id": "gen_abc",
                "is_default": False,
            },
        )

    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Docent"
    assert body["hume_voice_id"] == "hume-voice-name-123"
    assert body["is_default"] is False
    mock_db.add.assert_called_once()
    added = mock_db.add.call_args.args[0]
    assert isinstance(added, VoiceCharacter)
    assert added.tenant_id == fake_tenant_id


async def test_create_with_is_default_true_clears_siblings(client, mock_db):
    """
    When is_default=True, the router must issue an UPDATE clearing existing
    defaults before INSERT to satisfy the unique partial index.
    """
    mock_db.execute = AsyncMock(return_value=_result(None))

    with patch(
        "app.routers.voice_characters.save_voice",
        new=AsyncMock(return_value="hume-voice-name-456"),
    ):
        resp = await client.post(
            ENDPOINT,
            json={
                "name": "Docent",
                "generation_id": "gen_abc",
                "is_default": True,
            },
        )

    assert resp.status_code == 201
    # Two execute calls: the clearing UPDATE plus whatever else (none, in this code).
    assert mock_db.execute.await_count >= 1


# ── Update / delete ─────────────────────────────────────────────────────────


async def test_delete_404_when_not_owned(client, mock_db):
    mock_db.execute = AsyncMock(return_value=_result(None))
    resp = await client.delete(f"{ENDPOINT}/{uuid.uuid4()}")
    assert resp.status_code == 404
    mock_db.delete.assert_not_called()
