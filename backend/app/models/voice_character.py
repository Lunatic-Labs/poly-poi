import uuid

from sqlalchemy import Boolean, Column, DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import Base


class VoiceCharacter(Base):
    __tablename__ = "voice_characters"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text)
    hume_voice_id = Column(String, nullable=False)
    is_default = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())
