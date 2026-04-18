import re
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, field_validator


class TenantCreate(BaseModel):
    slug: str
    name: str
    contact_info: dict = {}

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, v: str) -> str:
        if not re.match(r"^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$", v):
            raise ValueError(
                "Slug must be 3–50 characters: lowercase letters, digits, or hyphens; "
                "no leading or trailing hyphens"
            )
        return v


class TenantUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    branding: Optional[dict] = None
    enabled_modules: Optional[dict] = None
    operating_hours: Optional[dict] = None
    contact_info: Optional[dict] = None

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, v: str | None) -> str | None:
        if v is not None and not re.match(r"^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$", v):
            raise ValueError(
                "Slug must be 3–50 characters: lowercase letters, digits, or hyphens; "
                "no leading or trailing hyphens"
            )
        return v


class TenantResponse(BaseModel):
    id: UUID
    slug: str
    name: str
    branding: dict
    enabled_modules: dict
    operating_hours: dict
    contact_info: dict
    monthly_token_budget: Optional[int] = None
    tokens_used_this_month: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
