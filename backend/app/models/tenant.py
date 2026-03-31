import uuid

from sqlalchemy import Column, DateTime, Integer, String, func
from sqlalchemy.dialects.postgresql import JSON, UUID

from app.models.base import Base


class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    branding = Column(JSON, nullable=False, default=dict)
    enabled_modules = Column(
        JSON,
        nullable=False,
        default=lambda: {"chatbot": True, "map": True, "recommendations": True},
    )
    operating_hours = Column(JSON, nullable=False, default=dict)
    contact_info = Column(JSON, nullable=False, default=dict)
    monthly_token_budget = Column(Integer)
    tokens_used_this_month = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())
