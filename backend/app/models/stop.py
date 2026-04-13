import uuid

from sqlalchemy import ARRAY, Boolean, Column, DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.types import Float

from app.models.base import Base


class Stop(Base):
    __tablename__ = "stops"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    category = Column(String, nullable=False, default="landmark")
    is_accessible = Column(Boolean, nullable=False, default=False)
    interest_tags = Column(ARRAY(String), nullable=False, default=list)
    photo_urls = Column(ARRAY(String), nullable=False, default=list)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())
