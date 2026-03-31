from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class RouteCreate(BaseModel):
    name: str
    description: Optional[str] = None
    stop_order: list[UUID] = []


class RouteUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    stop_order: Optional[list[UUID]] = None


class RouteResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    description: Optional[str]
    stop_order: list[UUID]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
