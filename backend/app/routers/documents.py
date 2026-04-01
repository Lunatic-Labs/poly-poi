import logging
import uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.tenant import get_tenant_id
from app.models.document import Document
from app.schemas.document import DocumentResponse
from app.workers.ingest import enqueue_ingest

router = APIRouter(prefix="/api/admin", tags=["documents"])

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
}
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB


@router.get("/documents", response_model=list[DocumentResponse])
async def list_documents(
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Document)
        .where(Document.tenant_id == tenant_id)
        .order_by(Document.created_at.desc())
    )
    return result.scalars().all()


@router.post(
    "/documents", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED
)
async def upload_document(
    file: UploadFile,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File exceeds 20 MB limit",
        )

    mime_type = file.content_type or "application/octet-stream"
    if mime_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported file type. Upload PDF, DOCX, or plain text.",
        )

    storage_path = f"{tenant_id}/documents/{uuid.uuid4()}/{file.filename}"

    async with httpx.AsyncClient() as client:
        resp = await client.put(
            f"{settings.supabase_url}/storage/v1/object/tenant-assets/{storage_path}",
            content=content,
            headers={
                "Authorization": f"Bearer {settings.supabase_service_role_key}",
                "Content-Type": mime_type,
                "x-upsert": "true",
            },
        )
        resp.raise_for_status()

    document = Document(
        tenant_id=tenant_id,
        filename=file.filename or "untitled",
        storage_path=storage_path,
        mime_type=mime_type,
        status="pending",
    )
    db.add(document)
    await db.commit()
    await db.refresh(document)

    try:
        await enqueue_ingest(str(document.id))
    except Exception:
        logging.getLogger(__name__).warning(
            "Could not enqueue ingest job for document %s — is Redis running?",
            document.id,
        )

    return document


@router.get("/documents/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Document).where(
            Document.id == document_id, Document.tenant_id == tenant_id
        )
    )
    document = result.scalar_one_or_none()
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Document not found"
        )
    return document


@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Document).where(
            Document.id == document_id, Document.tenant_id == tenant_id
        )
    )
    document = result.scalar_one_or_none()
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Document not found"
        )
    await db.delete(document)
    await db.commit()
