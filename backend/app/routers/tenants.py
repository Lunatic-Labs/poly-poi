import io
import uuid

import qrcode
from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy.exc import IntegrityError
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.admin_profile import AdminProfile
from app.models.tenant import Tenant
from app.schemas.tenant import TenantCreate, TenantResponse, TenantUpdate

router = APIRouter(prefix="/api", tags=["tenants"])


async def _require_tenant(user_id: str, db: AsyncSession) -> Tenant:
    """Return the tenant for this admin user, or raise 404."""
    result = await db.execute(
        select(Tenant)
        .join(AdminProfile, AdminProfile.tenant_id == Tenant.id)
        .where(AdminProfile.id == uuid.UUID(user_id))
    )
    tenant = result.scalar_one_or_none()
    if tenant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No tenant found for this user",
        )
    return tenant


# ── Public endpoints ───────────────────────────────────────────────────────────


@router.get("/tenant/{slug}/check")
async def check_slug_available(slug: str, db: AsyncSession = Depends(get_db)):
    """Return whether a slug is available."""
    result = await db.execute(select(Tenant.id).where(Tenant.slug == slug))
    return {"available": result.scalar_one_or_none() is None}


@router.get("/tenant/{slug}", response_model=TenantResponse)
async def get_tenant_by_slug(slug: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Tenant).where(Tenant.slug == slug))
    tenant = result.scalar_one_or_none()
    if tenant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found"
        )
    return tenant


@router.get("/tenant/{slug}/qr")
async def get_tenant_qr(slug: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Tenant.id).where(Tenant.slug == slug))
    if result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found"
        )

    visitor_url = f"{settings.visitor_app_base_url}/app/{slug}"
    img = qrcode.make(visitor_url)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return StreamingResponse(buf, media_type="image/png")


# ── Admin endpoints (authenticated) ───────────────────────────────────────────


@router.post(
    "/admin/tenants", response_model=TenantResponse, status_code=status.HTTP_201_CREATED
)
async def create_tenant(
    body: TenantCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = current_user["sub"]

    existing = await db.execute(
        select(AdminProfile).where(AdminProfile.id == uuid.UUID(user_id))
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="User already has a tenant"
        )

    tenant = Tenant(slug=body.slug, name=body.name, contact_info=body.contact_info)
    db.add(tenant)
    # flush (not commit) so a slug collision is caught before we create the AdminProfile
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Slug already taken"
        )

    profile = AdminProfile(id=uuid.UUID(user_id), tenant_id=tenant.id)
    db.add(profile)
    await db.commit()
    await db.refresh(tenant)
    return tenant


@router.get("/admin/tenants/me", response_model=TenantResponse)
async def get_my_tenant(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _require_tenant(current_user["sub"], db)


@router.patch("/admin/tenants/me", response_model=TenantResponse)
async def update_my_tenant(
    body: TenantUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tenant = await _require_tenant(current_user["sub"], db)

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(tenant, field, value)

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Slug already taken"
        )
    await db.refresh(tenant)
    return tenant


@router.post("/admin/tenants/me/logo")
async def upload_logo(
    file: UploadFile,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    import httpx

    tenant = await _require_tenant(current_user["sub"], db)

    content = await file.read()
    storage_path = f"{tenant.id}/logo/{file.filename}"
    content_type = file.content_type or "image/png"

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

    logo_url = (
        f"{settings.supabase_url}/storage/v1/object/public/tenant-assets/{storage_path}"
    )

    branding = dict(tenant.branding or {})
    branding["logo_url"] = logo_url
    tenant.branding = branding

    await db.commit()
    await db.refresh(tenant)
    return {"logo_url": logo_url}
