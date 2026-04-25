"""
Public visitor voice proxies — STT (OpenAI) and TTS (Hume) over HTTPS.

Both Hume and OpenAI keys stay server-side. Visitor clients never see them.
All endpoints require `tenant.enabled_modules.voice == True` — listing or
synthesis on a tenant where voice is disabled returns 403.
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.tenant import resolve_tenant_by_slug
from app.models.tenant import Tenant
from app.models.voice_character import VoiceCharacter
from app.schemas.voice_character import VoiceTTSRequest
from app.services.hume import tts_stream
from app.services.transcription import transcribe

router = APIRouter(prefix="/api", tags=["voice"])

ALLOWED_AUDIO_MIME_TYPES = {
    "audio/webm",
    "audio/ogg",
    "audio/mp4",
    "audio/mpeg",
    "audio/wav",
    "audio/x-wav",
}
MAX_AUDIO_SIZE = 1 * 1024 * 1024  # 1 MB ≈ 60 s of compressed visitor speech


def require_voice_enabled(tenant: Tenant) -> None:
    """Raise 403 if voice is not enabled for this tenant."""
    enabled = (tenant.enabled_modules or {}).get("voice", False)
    if not enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Voice mode is not enabled for this tenant",
        )


@router.post("/{slug}/voice/transcribe")
async def visitor_transcribe(
    slug: str,
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
) -> dict:
    tenant = await resolve_tenant_by_slug(slug, db)
    require_voice_enabled(tenant)

    content = await file.read()
    if len(content) > MAX_AUDIO_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Audio exceeds 1 MB limit",
        )

    mime_type = file.content_type or ""
    if mime_type not in ALLOWED_AUDIO_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported audio type: {mime_type or 'unknown'}",
        )

    text = await transcribe(content, file.filename or "audio.webm")
    return {"text": text}


@router.post("/{slug}/voice/tts")
async def visitor_tts(
    slug: str,
    body: VoiceTTSRequest,
    db: AsyncSession = Depends(get_db),
):
    tenant = await resolve_tenant_by_slug(slug, db)
    require_voice_enabled(tenant)

    # Tenant-scoped lookup — visitors for slug A cannot synthesize using a voice
    # character that belongs to tenant B.
    result = await db.execute(
        select(VoiceCharacter).where(
            VoiceCharacter.id == body.voice_character_id,
            VoiceCharacter.tenant_id == tenant.id,
        )
    )
    character: VoiceCharacter | None = result.scalar_one_or_none()
    if character is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Voice character not found"
        )

    return StreamingResponse(
        tts_stream(body.text, character.hume_voice_id),
        media_type="audio/mpeg",
    )


# Re-exported so visitor.py can use the same gate without a circular import dance.
__all__ = ["router", "require_voice_enabled"]
