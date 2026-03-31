from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class DocumentResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    filename: str
    storage_path: str
    mime_type: Optional[str]
    status: str
    token_count: Optional[int]
    chunk_count: Optional[int]
    error_message: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
