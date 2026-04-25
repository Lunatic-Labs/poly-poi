import uuid

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.admin_profile import AdminProfile
from app.models.tenant import Tenant


async def get_tenant_id(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> uuid.UUID:
    """FastAPI dependency: return the tenant_id for the authenticated admin user."""
    result = await db.execute(
        select(AdminProfile.tenant_id).where(
            AdminProfile.id == uuid.UUID(current_user["sub"])
        )
    )
    tenant_id = result.scalar_one_or_none()
    if tenant_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No tenant found for this user",
        )
    return tenant_id


async def resolve_tenant_by_slug(slug: str, db: AsyncSession) -> Tenant:
    """Public visitor routes: look up a tenant by its public slug or 404."""
    result = await db.execute(select(Tenant).where(Tenant.slug == slug))
    tenant = result.scalar_one_or_none()
    if tenant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found"
        )
    return tenant
