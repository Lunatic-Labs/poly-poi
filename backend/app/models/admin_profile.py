from sqlalchemy import Column, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import Base


class AdminProfile(Base):
    __tablename__ = "admin_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True)  # mirrors auth.users.id
    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())
