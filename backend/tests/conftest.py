import os

# Must precede all app imports — Settings() and AsyncOpenAI() run at module level
os.environ.setdefault("SUPABASE_URL", "http://localhost:54321")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-jwt-secret")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test")
os.environ.setdefault("OPENAI_API_KEY", "sk-test-key")
os.environ.setdefault("HUME_API_KEY", "test-hume-key")

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.database import get_db
from app.core.tenant import get_tenant_id
from app.main import app

FAKE_TENANT_ID = uuid.uuid4()


@pytest.fixture
def fake_tenant_id() -> uuid.UUID:
    return FAKE_TENANT_ID


@pytest.fixture
def mock_db():
    """
    Mocked AsyncSession. .refresh() side_effect populates server-default timestamp fields
    (created_at, updated_at) that would normally be set by a real DB round-trip.
    """
    session = AsyncMock()
    session.add = MagicMock()  # session.add is sync in SQLAlchemy

    async def _populate_timestamps(obj):
        # db.refresh() in real SQLAlchemy fetches all server-generated values (pk, timestamps).
        # Since commit() is mocked and never runs SQL, we populate them here instead.
        now = datetime(2025, 1, 1, tzinfo=timezone.utc)
        if hasattr(obj, "id") and obj.id is None:
            obj.id = uuid.uuid4()
        if hasattr(obj, "created_at") and obj.created_at is None:
            obj.created_at = now
        if hasattr(obj, "updated_at") and obj.updated_at is None:
            obj.updated_at = now

    session.refresh = AsyncMock(side_effect=_populate_timestamps)
    return session


@pytest.fixture
async def client(mock_db, fake_tenant_id):
    """
    AsyncClient against the live ASGI app with auth and tenant dependencies overridden.

    get_tenant_id → returns FAKE_TENANT_ID (skips JWT + AdminProfile lookup)
    get_db        → yields mock_db (skips real database)

    Overrides are cleared after each test to avoid cross-test contamination.
    """

    async def _override_db():
        yield mock_db

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[get_tenant_id] = lambda: fake_tenant_id

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac

    app.dependency_overrides.clear()
