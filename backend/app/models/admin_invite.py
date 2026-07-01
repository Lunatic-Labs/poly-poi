import uuid

from sqlalchemy import Column, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import Base


class AdminInvite(Base):
    __tablename__ = "admin_invites"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )
    code = Column(String, nullable=False, unique=True)
    email = Column(String)  # optional intended recipient — informational only
    role = Column(String, nullable=False, server_default="member")
    created_by = Column(UUID(as_uuid=True), nullable=False)  # auth.users.id of inviter
    expires_at = Column(DateTime(timezone=True), nullable=False)
    accepted_at = Column(DateTime(timezone=True))
    accepted_by = Column(UUID(as_uuid=True))  # auth.users.id of the redeemer
    created_at = Column(DateTime(timezone=True), server_default=func.now())
