from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class VoiceDesignPreviewRequest(BaseModel):
    description: str = Field(..., min_length=4, max_length=500)


class VoiceDesignPreviewResponse(BaseModel):
    generation_id: str
    audio_base64: str
    format: str  # e.g. "mp3"


class VoiceCharacterCreate(BaseModel):
    """Save a previewed voice. `generation_id` comes from a prior preview call."""

    name: str = Field(..., min_length=1, max_length=80)
    description: Optional[str] = Field(None, max_length=500)
    generation_id: str
    is_default: bool = False


class VoiceCharacterUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=80)
    description: Optional[str] = Field(None, max_length=500)
    is_default: Optional[bool] = None


class VoiceCharacterResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    description: Optional[str]
    hume_voice_id: str
    is_default: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class VoiceTTSRequest(BaseModel):
    """Visitor-facing: read this text in this voice."""

    text: str = Field(..., min_length=1, max_length=2000)
    voice_character_id: UUID
