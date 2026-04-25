"""
Thin async client for Hume.ai's TTS + Voice Design REST endpoints.

Built directly on httpx to match the existing Supabase Storage proxy pattern
in routers/documents.py — no Hume SDK dependency.

Three operations:
  1. design_voice — generate audio + generation_id from a natural-language description
  2. save_voice  — promote a generation_id into a reusable named voice
  3. tts_stream  — stream MP3 bytes for given text using a saved voice

Hume references saved voices by a unique `name` string, not by ID. We use a
UUID as the voice name on save to guarantee uniqueness across the account
and decouple the Hume-side identity from the admin's display name.
"""

import base64
import uuid
from typing import AsyncIterator

import httpx

from app.core.config import settings

_HUME_BASE = "https://api.hume.ai"


class HumeError(RuntimeError):
    """Raised on Hume API failures (non-2xx)."""


def _headers() -> dict[str, str]:
    return {
        "X-Hume-Api-Key": settings.hume_api_key,
        "Content-Type": "application/json",
    }


async def design_voice(
    description: str, sample_text: str = "Hi there, I'll be your guide today."
) -> dict:
    """
    Generate a Voice Design preview.

    Returns {generation_id, audio_base64, format}. The generation_id is what
    the admin saves once they're happy with the preview audio.
    """
    payload = {
        "utterances": [{"description": description, "text": sample_text}],
        "num_generations": 1,
        "version": "1",
        "format": {"type": "mp3"},
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            f"{_HUME_BASE}/v0/tts", json=payload, headers=_headers()
        )
    if resp.status_code >= 400:
        raise HumeError(f"Voice design failed ({resp.status_code}): {resp.text}")

    data = resp.json()
    generations = data.get("generations") or []
    if not generations:
        raise HumeError("Voice design returned no generations")

    gen = generations[0]
    audio = gen.get("audio")
    generation_id = gen.get("generation_id")
    if not audio or not generation_id:
        raise HumeError("Voice design response missing audio or generation_id")

    # Hume returns audio either base64-encoded (string) or as a URL — normalize to base64.
    if isinstance(audio, dict) and "data" in audio:
        audio_b64 = audio["data"]
    elif isinstance(audio, str):
        audio_b64 = audio
    else:
        raise HumeError("Voice design response audio in unexpected shape")

    return {
        "generation_id": generation_id,
        "audio_base64": audio_b64,
        "format": "mp3",
    }


async def save_voice(generation_id: str) -> str:
    """
    Promote a Voice Design generation to a reusable named voice.

    Returns the Hume voice `name` string to store in voice_characters.hume_voice_id.
    """
    voice_name = str(uuid.uuid4())
    payload = {"generation_id": generation_id, "name": voice_name}
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{_HUME_BASE}/v0/tts/voices", json=payload, headers=_headers()
        )
    if resp.status_code >= 400:
        raise HumeError(f"Voice save failed ({resp.status_code}): {resp.text}")
    return voice_name


async def tts_stream(text: str, hume_voice_name: str) -> AsyncIterator[bytes]:
    """
    Stream MP3 bytes for text spoken in the given saved voice.

    Yields raw audio bytes suitable for piping into a FastAPI StreamingResponse.
    """
    payload = {
        "utterances": [
            {
                "text": text,
                "voice": {"name": hume_voice_name, "provider": "CUSTOM_VOICE"},
            }
        ],
        "format": {"type": "mp3"},
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        async with client.stream(
            "POST",
            f"{_HUME_BASE}/v0/tts/stream/file",
            json=payload,
            headers=_headers(),
        ) as resp:
            if resp.status_code >= 400:
                body = await resp.aread()
                raise HumeError(
                    f"TTS stream failed ({resp.status_code}): {body.decode(errors='replace')}"
                )
            async for chunk in resp.aiter_bytes():
                yield chunk


def decode_audio(audio_base64: str) -> bytes:
    """Helper for tests / one-off uses."""
    return base64.b64decode(audio_base64)
