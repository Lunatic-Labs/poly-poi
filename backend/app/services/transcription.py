"""
Speech-to-text wrapper around OpenAI's transcription API.

Uses gpt-4o-mini-transcribe — newer than legacy whisper-1 and faster for
short visitor-question utterances. Reuses the module-level AsyncOpenAI client
pattern from services/query.py.
"""

import io

from openai import AsyncOpenAI

from app.core.config import settings

_TRANSCRIBE_MODEL = "gpt-4o-mini-transcribe"

_openai = AsyncOpenAI(api_key=settings.openai_api_key)


async def transcribe(audio_bytes: bytes, filename: str) -> str:
    """
    Send audio to OpenAI for transcription. Returns the transcribed text.

    `filename` is required by the SDK to infer the audio format from the extension
    (e.g. "clip.webm", "clip.m4a"). Pass through whatever the client sent.
    """
    buf = io.BytesIO(audio_bytes)
    buf.name = filename
    result = await _openai.audio.transcriptions.create(
        model=_TRANSCRIBE_MODEL,
        file=buf,
    )
    return result.text
