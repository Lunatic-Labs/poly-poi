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

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.tenant import Tenant
from app.services.query import query

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["chat"])


class ChatRequest(BaseModel):
    message: str
    session_id: str


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
    if not body.message.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Message cannot be empty",
        )

    tenant = await _resolve_tenant(slug, db)

    async def event_stream():
        try:
            async for token in query(tenant, body.message, body.session_id, db):
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
