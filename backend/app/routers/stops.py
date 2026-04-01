import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.tenant import get_tenant_id
from app.models.stop import Stop
from app.schemas.stop import StopCreate, StopResponse, StopUpdate

router = APIRouter(prefix="/api/admin", tags=["stops"])


@router.get("/stops", response_model=list[StopResponse])
async def list_stops(
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Stop).where(Stop.tenant_id == tenant_id))
    return result.scalars().all()


@router.post("/stops", response_model=StopResponse, status_code=status.HTTP_201_CREATED)
async def create_stop(
    body: StopCreate,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    stop = Stop(tenant_id=tenant_id, **body.model_dump())
    db.add(stop)
    await db.commit()
    await db.refresh(stop)
    return stop


@router.get("/stops/{stop_id}", response_model=StopResponse)
async def get_stop(
    stop_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Stop).where(Stop.id == stop_id, Stop.tenant_id == tenant_id)
    )
    stop = result.scalar_one_or_none()
    if stop is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Stop not found"
        )
    return stop


@router.patch("/stops/{stop_id}", response_model=StopResponse)
async def update_stop(
    stop_id: uuid.UUID,
    body: StopUpdate,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Stop).where(Stop.id == stop_id, Stop.tenant_id == tenant_id)
    )
    stop = result.scalar_one_or_none()
    if stop is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Stop not found"
        )
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(stop, field, value)
    await db.commit()
    await db.refresh(stop)
    return stop


@router.post("/stops/{stop_id}/photo", response_model=StopResponse)
async def upload_stop_photo(
    stop_id: uuid.UUID,
    file: UploadFile,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    import httpx

    result = await db.execute(
        select(Stop).where(Stop.id == stop_id, Stop.tenant_id == tenant_id)
    )
    stop = result.scalar_one_or_none()
    if stop is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Stop not found"
        )

    content = await file.read()
    storage_path = f"{tenant_id}/stops/{stop_id}/{file.filename}"
    content_type = file.content_type or "image/jpeg"

    async with httpx.AsyncClient() as client:
        resp = await client.put(
            f"{settings.supabase_url}/storage/v1/object/tenant-assets/{storage_path}",
            content=content,
            headers={
                "Authorization": f"Bearer {settings.supabase_service_role_key}",
                "Content-Type": content_type,
                "x-upsert": "true",
            },
        )
        resp.raise_for_status()

    photo_url = (
        f"{settings.supabase_url}/storage/v1/object/public/tenant-assets/{storage_path}"
    )
    stop.photo_urls = [*(stop.photo_urls or []), photo_url]
    await db.commit()
    await db.refresh(stop)
    return stop


@router.delete("/stops/{stop_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_stop(
    stop_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Stop).where(Stop.id == stop_id, Stop.tenant_id == tenant_id)
    )
    stop = result.scalar_one_or_none()
    if stop is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Stop not found"
        )
    await db.delete(stop)
    await db.commit()
