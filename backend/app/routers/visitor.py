"""
Public visitor API — no authentication required.

Routes are slug-scoped: GET /api/{slug}/<resource>

Visitor responses use narrow schemas from schemas/visitor.py that strip internal
fields (tenant_id, budget columns, admin timestamps) not appropriate for public exposure.

Route registration order matters: this router must be registered AFTER all other
/api/... routers in main.py so that specific patterns (e.g. /api/tenant/{slug})
take precedence over the broad /{slug}/... catch.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.tenant import resolve_tenant_by_slug
from app.models.amenity import Amenity
from app.models.route import Route
from app.models.stop import Stop
from app.models.voice_character import VoiceCharacter
from app.routers.voice import require_voice_enabled
from app.schemas.visitor import (
    VisitorAmenity,
    VisitorRoute,
    VisitorStop,
    VisitorTenantConfig,
    VisitorVoiceCharacter,
)

router = APIRouter(prefix="/api", tags=["visitor"])


@router.get("/{slug}/config", response_model=VisitorTenantConfig)
async def get_visitor_config(slug: str, db: AsyncSession = Depends(get_db)):
    return await resolve_tenant_by_slug(slug, db)


@router.get("/{slug}/stops", response_model=list[VisitorStop])
async def get_visitor_stops(slug: str, db: AsyncSession = Depends(get_db)):
    tenant = await resolve_tenant_by_slug(slug, db)
    result = await db.execute(select(Stop).where(Stop.tenant_id == tenant.id))
    return result.scalars().all()


@router.get("/{slug}/amenities", response_model=list[VisitorAmenity])
async def get_visitor_amenities(slug: str, db: AsyncSession = Depends(get_db)):
    tenant = await resolve_tenant_by_slug(slug, db)
    result = await db.execute(select(Amenity).where(Amenity.tenant_id == tenant.id))
    return result.scalars().all()


@router.get("/{slug}/routes", response_model=list[VisitorRoute])
async def get_visitor_routes(slug: str, db: AsyncSession = Depends(get_db)):
    tenant = await resolve_tenant_by_slug(slug, db)
    result = await db.execute(select(Route).where(Route.tenant_id == tenant.id))
    return result.scalars().all()


@router.get("/{slug}/voice-characters", response_model=list[VisitorVoiceCharacter])
async def get_visitor_voice_characters(slug: str, db: AsyncSession = Depends(get_db)):
    tenant = await resolve_tenant_by_slug(slug, db)
    require_voice_enabled(tenant)
    result = await db.execute(
        select(VoiceCharacter)
        .where(VoiceCharacter.tenant_id == tenant.id)
        .order_by(VoiceCharacter.is_default.desc(), VoiceCharacter.name)
    )
    return result.scalars().all()
