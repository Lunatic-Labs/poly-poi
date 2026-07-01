"""
Admin team management: multiple admins per tenant.

- Any admin of a tenant can invite others (generate a single-use code) and view
  the team.
- Only an 'owner' can remove a member, and the tenant's last owner can't be removed.
- A signed-up user with no tenant of their own redeems a code to join an existing
  tenant as an additional admin (POST /accept).

Tenant scoping is enforced here in application code — every query filters by the
caller's tenant_id (the backend uses the service_role key, which bypasses RLS).
"""

import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy import text as sa_text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.tenant import get_tenant_id
from app.models.admin_invite import AdminInvite
from app.models.admin_profile import AdminProfile
from app.models.tenant import Tenant
from app.schemas.team import (
    AcceptInviteRequest,
    AcceptInviteResponse,
    InviteCreate,
    InviteResponse,
    TeamMemberResponse,
)

router = APIRouter(prefix="/api/admin/team", tags=["team"])

INVITE_TTL = timedelta(days=7)


async def _caller_role(
    user_id: str, tenant_id: uuid.UUID, db: AsyncSession
) -> str | None:
    result = await db.execute(
        select(AdminProfile.role).where(
            AdminProfile.id == uuid.UUID(user_id),
            AdminProfile.tenant_id == tenant_id,
        )
    )
    return result.scalar_one_or_none()


# ── Team roster ────────────────────────────────────────────────────────────────


@router.get("/members", response_model=list[TeamMemberResponse])
async def list_members(
    current_user: dict = Depends(get_current_user),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    """List admins on the caller's tenant. Email comes from Supabase auth.users."""
    result = await db.execute(
        sa_text(
            """
            SELECT ap.id, ap.role, ap.created_at, u.email
            FROM admin_profiles ap
            JOIN auth.users u ON u.id = ap.id
            WHERE ap.tenant_id = :tenant_id
            ORDER BY ap.created_at
            """
        ),
        {"tenant_id": str(tenant_id)},
    )
    return [
        TeamMemberResponse(
            id=row["id"],
            email=row["email"],
            role=row["role"],
            is_self=str(row["id"]) == current_user["sub"],
            created_at=row["created_at"],
        )
        for row in result.mappings().all()
    ]


@router.delete("/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    user_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    """Remove a member from the caller's tenant. Owner-only; can't strand the site."""
    if str(user_id) == current_user["sub"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You can't remove yourself from the team",
        )

    if await _caller_role(current_user["sub"], tenant_id, db) != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only an owner can remove team members",
        )

    result = await db.execute(
        select(AdminProfile).where(
            AdminProfile.id == user_id,
            AdminProfile.tenant_id == tenant_id,
        )
    )
    target = result.scalar_one_or_none()
    if target is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="That person isn't on your team",
        )

    # Never remove the last owner — the site must always have one.
    if target.role == "owner":
        owner_count = await db.execute(
            select(func.count())
            .select_from(AdminProfile)
            .where(
                AdminProfile.tenant_id == tenant_id,
                AdminProfile.role == "owner",
            )
        )
        if (owner_count.scalar() or 0) <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Can't remove the only owner — assign another owner first",
            )

    await db.execute(
        delete(AdminProfile).where(
            AdminProfile.id == user_id,
            AdminProfile.tenant_id == tenant_id,
        )
    )
    await db.commit()


# ── Invites ──────────────────────────────────────────────────────────────────


@router.post(
    "/invites", response_model=InviteResponse, status_code=status.HTTP_201_CREATED
)
async def create_invite(
    body: InviteCreate,
    current_user: dict = Depends(get_current_user),
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    """Generate a single-use invite code for the caller's tenant."""
    expires_at = datetime.now(timezone.utc) + INVITE_TTL

    # token_urlsafe(9) ≈ 72 bits of entropy; retry on the astronomically rare
    # code collision rather than surfacing a 500.
    for _ in range(3):
        invite = AdminInvite(
            tenant_id=tenant_id,
            code=secrets.token_urlsafe(9),
            email=body.email,
            role=body.role,
            created_by=uuid.UUID(current_user["sub"]),
            expires_at=expires_at,
        )
        db.add(invite)
        try:
            await db.flush()
            break
        except IntegrityError:
            await db.rollback()
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not generate a unique invite code, please try again",
        )

    await db.commit()
    await db.refresh(invite)
    return invite


@router.get("/invites", response_model=list[InviteResponse])
async def list_invites(
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    """List pending (unredeemed, unexpired) invites for the caller's tenant."""
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(AdminInvite)
        .where(
            AdminInvite.tenant_id == tenant_id,
            AdminInvite.accepted_at.is_(None),
            AdminInvite.expires_at > now,
        )
        .order_by(AdminInvite.created_at.desc())
    )
    return list(result.scalars().all())


@router.delete("/invites/{invite_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_invite(
    invite_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    """Revoke a pending invite. Scoped to the caller's tenant."""
    result = await db.execute(
        select(AdminInvite).where(
            AdminInvite.id == invite_id,
            AdminInvite.tenant_id == tenant_id,
        )
    )
    invite = result.scalar_one_or_none()
    if invite is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found"
        )

    await db.execute(delete(AdminInvite).where(AdminInvite.id == invite_id))
    await db.commit()


# ── Redeem (join an existing tenant) ─────────────────────────────────────────


@router.post("/accept", response_model=AcceptInviteResponse)
async def accept_invite(
    body: AcceptInviteRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Redeem an invite code to join its tenant as an additional admin.

    Uses get_current_user (not get_tenant_id): the caller is signed in but has no
    tenant of their own yet. One user can belong to exactly one tenant.
    """
    user_id = uuid.UUID(current_user["sub"])

    existing = await db.execute(select(AdminProfile).where(AdminProfile.id == user_id))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already belong to a site. Sign in with a different account to join another.",
        )

    result = await db.execute(select(AdminInvite).where(AdminInvite.code == body.code))
    invite = result.scalar_one_or_none()
    if invite is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Invite code not found"
        )
    if invite.accepted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This invite has already been used",
        )
    if invite.expires_at <= datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_410_GONE, detail="This invite has expired"
        )

    tenant_result = await db.execute(
        select(Tenant).where(Tenant.id == invite.tenant_id)
    )
    tenant = tenant_result.scalar_one_or_none()
    if tenant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The site for this invite no longer exists",
        )

    db.add(AdminProfile(id=user_id, tenant_id=invite.tenant_id, role=invite.role))
    invite.accepted_at = datetime.now(timezone.utc)
    invite.accepted_by = user_id
    try:
        await db.commit()
    except IntegrityError:
        # Concurrent redeem for the same user — the PK on admin_profiles.id caught it.
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already belong to a site.",
        )

    return AcceptInviteResponse(
        tenant_id=tenant.id,
        tenant_slug=tenant.slug,
        tenant_name=tenant.name,
        role=invite.role,
    )
