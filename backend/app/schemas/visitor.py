from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class VisitorBranding(BaseModel):
    primary_color: Optional[str] = None
    accent_color: Optional[str] = None
    logo_url: Optional[str] = None
    welcome_text: Optional[str] = None
    tone_preset: Optional[str] = None


class VisitorEnabledModules(BaseModel):
    chatbot: bool = True
    map: bool = True
    recommendations: bool = True
    routes: bool = True


class VisitorTenantConfig(BaseModel):
    """Narrow tenant config for visitor app — strips admin and billing fields."""

    slug: str
    name: str
    branding: VisitorBranding
    enabled_modules: VisitorEnabledModules
    operating_hours: dict
    contact_info: dict

    model_config = {"from_attributes": True}


class VisitorStop(BaseModel):
    """Stop data safe to expose to visitors — strips tenant_id and timestamps."""

    id: UUID
    name: str
    description: Optional[str]
    lat: float
    lng: float
    category: str
    is_accessible: bool
    interest_tags: list[str]
    photo_urls: list[str]

    model_config = {"from_attributes": True}


class VisitorAmenity(BaseModel):
    """Amenity data safe to expose to visitors."""

    id: UUID
    name: str
    type: str
    lat: float
    lng: float
    hours: dict
    notes: Optional[str]

    model_config = {"from_attributes": True}


class VisitorRoute(BaseModel):
    """Route data safe to expose to visitors."""

    id: UUID
    name: str
    description: Optional[str]
    stop_order: list[UUID]

    model_config = {"from_attributes": True}
