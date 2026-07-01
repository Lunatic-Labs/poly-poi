"""
Tests for admin team management (multiple admins per tenant).

Endpoints that operate on the caller's own tenant depend on get_tenant_id (overridden
by the `client` fixture). Endpoints used by a not-yet-onboarded user — /accept — and
those that need the caller's identity — /members, remove — depend directly on
get_current_user, which we override per-test with `as_current_user`.
"""

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.auth import get_current_user
from app.main import app
from app.models.admin_invite import AdminInvite
from app.models.admin_profile import AdminProfile
from app.models.tenant import Tenant

BASE = "/api/admin/team"
USER_ID = str(uuid.uuid4())


@pytest.fixture
def as_current_user():
    """Override the JWT-derived user so team endpoints see an authenticated caller."""
    app.dependency_overrides[get_current_user] = lambda: {"sub": USER_ID}
    yield USER_ID
    app.dependency_overrides.pop(get_current_user, None)


def _scalar(value):
    result = MagicMock()
    result.scalar_one_or_none = MagicMock(return_value=value)
    result.scalar = MagicMock(return_value=value)
    return result


def _scalars(items):
    result = MagicMock()
    result.scalars = MagicMock(return_value=MagicMock(all=MagicMock(return_value=items)))
    return result


def _mappings(rows):
    result = MagicMock()
    result.mappings = MagicMock(return_value=MagicMock(all=MagicMock(return_value=rows)))
    return result


def _future():
    return datetime.now(timezone.utc) + timedelta(days=1)


def _past():
    return datetime.now(timezone.utc) - timedelta(days=1)


# ── Roster ───────────────────────────────────────────────────────────────────


async def test_list_members_marks_self(client, mock_db, as_current_user):
    now = datetime.now(timezone.utc)
    rows = [
        {"id": uuid.UUID(USER_ID), "role": "owner", "created_at": now, "email": "me@x.com"},
        {"id": uuid.uuid4(), "role": "member", "created_at": now, "email": "them@x.com"},
    ]
    mock_db.execute = AsyncMock(return_value=_mappings(rows))

    resp = await client.get(f"{BASE}/members")

    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 2
    assert body[0]["is_self"] is True
    assert body[0]["role"] == "owner"
    assert body[1]["is_self"] is False


# ── Invites ──────────────────────────────────────────────────────────────────


async def test_create_invite_generates_code(client, mock_db, as_current_user):
    resp = await client.post(f"{BASE}/invites", json={"email": "new@x.com"})

    assert resp.status_code == 201
    body = resp.json()
    assert body["code"]  # non-empty generated code
    assert body["role"] == "member"
    assert body["email"] == "new@x.com"
    mock_db.commit.assert_awaited()


async def test_list_invites_returns_pending(client, mock_db):
    invite = AdminInvite(
        id=uuid.uuid4(),
        tenant_id=uuid.uuid4(),
        code="abc123",
        email=None,
        role="member",
        created_by=uuid.uuid4(),
        expires_at=_future(),
        created_at=datetime.now(timezone.utc),
    )
    mock_db.execute = AsyncMock(return_value=_scalars([invite]))

    resp = await client.get(f"{BASE}/invites")

    assert resp.status_code == 200
    assert resp.json()[0]["code"] == "abc123"


async def test_revoke_unknown_invite_404(client, mock_db):
    mock_db.execute = AsyncMock(return_value=_scalar(None))

    resp = await client.delete(f"{BASE}/invites/{uuid.uuid4()}")

    assert resp.status_code == 404


# ── Redeem (join a tenant) ───────────────────────────────────────────────────


def _invite(**kw):
    defaults = dict(
        id=uuid.uuid4(),
        tenant_id=uuid.uuid4(),
        code="joincode",
        email=None,
        role="member",
        created_by=uuid.uuid4(),
        expires_at=_future(),
        accepted_at=None,
        accepted_by=None,
        created_at=datetime.now(timezone.utc),
    )
    defaults.update(kw)
    return AdminInvite(**defaults)


async def test_accept_invite_joins_tenant(client, mock_db, as_current_user):
    invite = _invite()
    tenant = Tenant(id=invite.tenant_id, slug="museum", name="City Museum")
    mock_db.execute = AsyncMock(
        side_effect=[
            _scalar(None),      # no existing profile
            _scalar(invite),    # invite lookup by code
            _scalar(tenant),    # tenant lookup
        ]
    )

    resp = await client.post(f"{BASE}/accept", json={"code": "joincode"})

    assert resp.status_code == 200
    body = resp.json()
    assert body["tenant_slug"] == "museum"
    assert body["role"] == "member"
    mock_db.commit.assert_awaited()


async def test_accept_invite_rejects_existing_admin(client, mock_db, as_current_user):
    existing = AdminProfile(id=uuid.UUID(USER_ID), tenant_id=uuid.uuid4(), role="owner")
    mock_db.execute = AsyncMock(return_value=_scalar(existing))

    resp = await client.post(f"{BASE}/accept", json={"code": "joincode"})

    assert resp.status_code == 409


async def test_accept_invite_unknown_code_404(client, mock_db, as_current_user):
    mock_db.execute = AsyncMock(side_effect=[_scalar(None), _scalar(None)])

    resp = await client.post(f"{BASE}/accept", json={"code": "nope"})

    assert resp.status_code == 404


async def test_accept_invite_expired_410(client, mock_db, as_current_user):
    mock_db.execute = AsyncMock(
        side_effect=[_scalar(None), _scalar(_invite(expires_at=_past()))]
    )

    resp = await client.post(f"{BASE}/accept", json={"code": "joincode"})

    assert resp.status_code == 410


async def test_accept_invite_already_used_409(client, mock_db, as_current_user):
    mock_db.execute = AsyncMock(
        side_effect=[
            _scalar(None),
            _scalar(_invite(accepted_at=datetime.now(timezone.utc))),
        ]
    )

    resp = await client.post(f"{BASE}/accept", json={"code": "joincode"})

    assert resp.status_code == 409


# ── Remove member ────────────────────────────────────────────────────────────


async def test_remove_self_rejected(client, mock_db, as_current_user):
    resp = await client.delete(f"{BASE}/members/{USER_ID}")
    assert resp.status_code == 400


async def test_remove_member_requires_owner(client, mock_db, as_current_user):
    mock_db.execute = AsyncMock(return_value=_scalar("member"))  # caller role

    resp = await client.delete(f"{BASE}/members/{uuid.uuid4()}")

    assert resp.status_code == 403


async def test_owner_removes_member(client, mock_db, as_current_user):
    target = AdminProfile(id=uuid.uuid4(), tenant_id=uuid.uuid4(), role="member")
    mock_db.execute = AsyncMock(
        side_effect=[
            _scalar("owner"),   # caller role
            _scalar(target),    # target lookup
            _scalar(None),      # delete
        ]
    )

    resp = await client.delete(f"{BASE}/members/{target.id}")

    assert resp.status_code == 204
    mock_db.commit.assert_awaited()


async def test_cannot_remove_last_owner(client, mock_db, as_current_user):
    target = AdminProfile(id=uuid.uuid4(), tenant_id=uuid.uuid4(), role="owner")
    mock_db.execute = AsyncMock(
        side_effect=[
            _scalar("owner"),   # caller role
            _scalar(target),    # target lookup (an owner)
            _scalar(1),         # owner count == 1
        ]
    )

    resp = await client.delete(f"{BASE}/members/{target.id}")

    assert resp.status_code == 400
