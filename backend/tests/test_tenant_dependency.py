"""
Tests for get_tenant_id — the FastAPI dependency that every admin route depends on.

Called directly as an async function to test the logic in isolation,
without routing or test client overhead.
"""
import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from app.core.tenant import get_tenant_id


async def test_success_returns_tenant_id():
    tenant_id = uuid.uuid4()
    user_id = uuid.uuid4()

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = tenant_id

    db = AsyncMock()
    db.execute = AsyncMock(return_value=mock_result)

    result = await get_tenant_id(
        current_user={"sub": str(user_id)},
        db=db,
    )

    assert result == tenant_id
    db.execute.assert_called_once()


async def test_missing_profile_raises_404():
    user_id = uuid.uuid4()

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None

    db = AsyncMock()
    db.execute = AsyncMock(return_value=mock_result)

    with pytest.raises(HTTPException) as exc_info:
        await get_tenant_id(
            current_user={"sub": str(user_id)},
            db=db,
        )

    assert exc_info.value.status_code == 404
    assert "No tenant found" in exc_info.value.detail
