import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.tenant import get_tenant_id
from app.models.amenity import Amenity
from app.schemas.amenity import AmenityCreate, AmenityResponse, AmenityUpdate

router = APIRouter(prefix="/api/admin", tags=["amenities"])


@router.get("/amenities", response_model=list[AmenityResponse])
async def list_amenities(
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Amenity).where(Amenity.tenant_id == tenant_id))
    return result.scalars().all()


@router.post(
    "/amenities", response_model=AmenityResponse, status_code=status.HTTP_201_CREATED
)
async def create_amenity(
    body: AmenityCreate,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    amenity = Amenity(tenant_id=tenant_id, **body.model_dump())
    db.add(amenity)
    await db.commit()
    await db.refresh(amenity)
    return amenity


@router.get("/amenities/{amenity_id}", response_model=AmenityResponse)
async def get_amenity(
    amenity_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Amenity).where(Amenity.id == amenity_id, Amenity.tenant_id == tenant_id)
    )
    amenity = result.scalar_one_or_none()
    if amenity is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Amenity not found"
        )
    return amenity


@router.patch("/amenities/{amenity_id}", response_model=AmenityResponse)
async def update_amenity(
    amenity_id: uuid.UUID,
    body: AmenityUpdate,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Amenity).where(Amenity.id == amenity_id, Amenity.tenant_id == tenant_id)
    )
    amenity = result.scalar_one_or_none()
    if amenity is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Amenity not found"
        )
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(amenity, field, value)
    await db.commit()
    await db.refresh(amenity)
    return amenity


@router.delete("/amenities/{amenity_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_amenity(
    amenity_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Amenity).where(Amenity.id == amenity_id, Amenity.tenant_id == tenant_id)
    )
    amenity = result.scalar_one_or_none()
    if amenity is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Amenity not found"
        )
    await db.delete(amenity)
    await db.commit()
