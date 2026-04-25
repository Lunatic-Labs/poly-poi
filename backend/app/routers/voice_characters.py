"""
Admin CRUD for voice characters (Hume Voice Design personas).

Two-step authoring flow:
  1. POST /design-preview — admin sends a description, gets back generation_id
     + base64 mp3 to play in the browser. Repeat until happy.
  2. POST /                — admin sends the chosen generation_id + name (+
     description, is_default). Backend saves the voice with Hume and persists.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.tenant import get_tenant_id
from app.models.voice_character import VoiceCharacter
from app.schemas.voice_character import (
    VoiceCharacterCreate,
    VoiceCharacterResponse,
    VoiceCharacterUpdate,
    VoiceDesignPreviewRequest,
    VoiceDesignPreviewResponse,
)
from app.services.hume import design_voice, save_voice

router = APIRouter(prefix="/api/admin", tags=["voice-characters"])


@router.get("/voice-characters", response_model=list[VoiceCharacterResponse])
async def list_voice_characters(
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(VoiceCharacter)
        .where(VoiceCharacter.tenant_id == tenant_id)
        .order_by(VoiceCharacter.created_at.desc())
    )
    return result.scalars().all()


@router.post(
    "/voice-characters/design-preview", response_model=VoiceDesignPreviewResponse
)
async def voice_design_preview(
    body: VoiceDesignPreviewRequest,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
):
    """Generate a Hume Voice Design preview. Each call returns a fresh generation_id."""
    result = await design_voice(body.description)
    return VoiceDesignPreviewResponse(**result)


@router.post(
    "/voice-characters",
    response_model=VoiceCharacterResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_voice_character(
    body: VoiceCharacterCreate,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    hume_voice_id = await save_voice(body.generation_id)

    if body.is_default:
        # Clear sibling default first to satisfy the unique partial index.
        await db.execute(
            update(VoiceCharacter)
            .where(
                VoiceCharacter.tenant_id == tenant_id,
                VoiceCharacter.is_default == True,  # noqa: E712
            )
            .values(is_default=False)
        )

    character = VoiceCharacter(
        tenant_id=tenant_id,
        name=body.name,
        description=body.description,
        hume_voice_id=hume_voice_id,
        is_default=body.is_default,
    )
    db.add(character)
    await db.commit()
    await db.refresh(character)
    return character


@router.patch("/voice-characters/{character_id}", response_model=VoiceCharacterResponse)
async def update_voice_character(
    character_id: uuid.UUID,
    body: VoiceCharacterUpdate,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(VoiceCharacter).where(
            VoiceCharacter.id == character_id,
            VoiceCharacter.tenant_id == tenant_id,
        )
    )
    character = result.scalar_one_or_none()
    if character is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Voice character not found"
        )

    updates = body.model_dump(exclude_unset=True)
    if updates.get("is_default") is True:
        await db.execute(
            update(VoiceCharacter)
            .where(
                VoiceCharacter.tenant_id == tenant_id,
                VoiceCharacter.id != character_id,
                VoiceCharacter.is_default == True,  # noqa: E712
            )
            .values(is_default=False)
        )

    for field, value in updates.items():
        setattr(character, field, value)
    await db.commit()
    await db.refresh(character)
    return character


@router.delete(
    "/voice-characters/{character_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_voice_character(
    character_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(VoiceCharacter).where(
            VoiceCharacter.id == character_id,
            VoiceCharacter.tenant_id == tenant_id,
        )
    )
    character = result.scalar_one_or_none()
    if character is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Voice character not found"
        )
    await db.delete(character)
    await db.commit()
