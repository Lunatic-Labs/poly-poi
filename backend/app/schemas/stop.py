from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel

StopCategory = Literal["exhibit", "trailhead", "building", "landmark", "other"]


class StopCreate(BaseModel):
    name: str
    description: Optional[str] = None
    lat: float
    lng: float
    category: StopCategory = "landmark"
    is_accessible: bool = False
    interest_tags: list[str] = []
    photo_urls: list[str] = []


class StopUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    category: Optional[StopCategory] = None
    is_accessible: Optional[bool] = None
    interest_tags: Optional[list[str]] = None
    photo_urls: Optional[list[str]] = None


class StopResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    description: Optional[str]
    lat: float
    lng: float
    category: str
    is_accessible: bool
    interest_tags: list[str]
    photo_urls: list[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
