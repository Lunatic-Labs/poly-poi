"""
Visitor chat endpoint — POST /api/{slug}/chat

Streams GPT-4o responses as Server-Sent Events (SSE).

SSE event format:
  data: {"t": "<token>"}\n\n   — text token
  data: {"done": true}\n\n     — stream complete
  data: {"error": "<msg>"}\n\n — error during streaming

The visitor app consumes this with fetch + ReadableStream (not EventSource,
since EventSource doesn't support POST).
"""

import json
import logging
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.tenant import Tenant
from app.services.query import query

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["chat"])


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=2000)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)
    session_id: str
    history: list[ChatMessage] = Field(default_factory=list, max_length=10)


async def _resolve_tenant(slug: str, db: AsyncSession) -> Tenant:
    result = await db.execute(select(Tenant).where(Tenant.slug == slug))
    tenant = result.scalar_one_or_none()
    if tenant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found"
        )
    return tenant


@router.post("/{slug}/chat")
async def chat(
    slug: str,
    body: ChatRequest,
    db: AsyncSession = Depends(get_db),
):
    tenant = await _resolve_tenant(slug, db)

    async def event_stream():
        try:
            async for token in query(
                tenant, body.message, body.session_id, body.history, db
            ):
                yield f"data: {json.dumps({'t': token})}\n\n"
        except Exception:
            logger.exception("Chat stream error for slug=%s", slug)
            yield f"data: {json.dumps({'error': 'An error occurred. Please try again.'})}\n\n"
        finally:
            yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disable nginx buffering for SSE
        },
    )
