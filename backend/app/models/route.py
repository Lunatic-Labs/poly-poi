import uuid

from sqlalchemy import ARRAY, Column, DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import Base


class Route(Base):
    __tablename__ = "routes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text)
    # UUID array, no FK — routes can reference stops that were later deleted.
    # Visitor map filters out orphaned IDs defensively when resolving.
    stop_order = Column(ARRAY(UUID(as_uuid=True)), nullable=False, default=list)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())
