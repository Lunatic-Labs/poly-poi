from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel

AmenityType = Literal[
    "restroom", "food", "parking", "emergency", "gift", "partner", "other"
]


class AmenityCreate(BaseModel):
    name: str
    type: AmenityType
    lat: float
    lng: float
    hours: dict = {}
    notes: Optional[str] = None


class AmenityUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[AmenityType] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    hours: Optional[dict] = None
    notes: Optional[str] = None


class AmenityResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    type: str
    lat: float
    lng: float
    hours: dict
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
