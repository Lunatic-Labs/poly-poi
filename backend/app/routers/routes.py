import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.tenant import get_tenant_id
from app.models.route import Route
from app.schemas.route import RouteCreate, RouteResponse, RouteUpdate

router = APIRouter(prefix="/api/admin", tags=["routes"])


@router.get("/routes", response_model=list[RouteResponse])
async def list_routes(
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Route).where(Route.tenant_id == tenant_id))
    return result.scalars().all()


@router.post(
    "/routes", response_model=RouteResponse, status_code=status.HTTP_201_CREATED
)
async def create_route(
    body: RouteCreate,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    route = Route(tenant_id=tenant_id, **body.model_dump())
    db.add(route)
    await db.commit()
    await db.refresh(route)
    return route


@router.get("/routes/{route_id}", response_model=RouteResponse)
async def get_route(
    route_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Route).where(Route.id == route_id, Route.tenant_id == tenant_id)
    )
    route = result.scalar_one_or_none()
    if route is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Route not found"
        )
    return route


@router.patch("/routes/{route_id}", response_model=RouteResponse)
async def update_route(
    route_id: uuid.UUID,
    body: RouteUpdate,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Route).where(Route.id == route_id, Route.tenant_id == tenant_id)
    )
    route = result.scalar_one_or_none()
    if route is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Route not found"
        )
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(route, field, value)
    await db.commit()
    await db.refresh(route)
    return route


@router.delete("/routes/{route_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_route(
    route_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Route).where(Route.id == route_id, Route.tenant_id == tenant_id)
    )
    route = result.scalar_one_or_none()
    if route is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Route not found"
        )
    await db.delete(route)
    await db.commit()
