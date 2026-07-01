from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field

Role = Literal["owner", "member"]


class InviteCreate(BaseModel):
    # Optional — recorded for the inviter's reference; the code is what grants access.
    email: Optional[str] = Field(default=None, max_length=254)
    role: Role = "member"


class InviteResponse(BaseModel):
    id: UUID
    code: str
    email: Optional[str] = None
    role: Role
    expires_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


class AcceptInviteRequest(BaseModel):
    code: str = Field(min_length=1, max_length=100)


class AcceptInviteResponse(BaseModel):
    tenant_id: UUID
    tenant_slug: str
    tenant_name: str
    role: Role


class TeamMemberResponse(BaseModel):
    id: UUID
    email: Optional[str] = None
    role: Role
    is_self: bool
    created_at: datetime
