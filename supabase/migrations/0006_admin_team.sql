-- Multi-admin teams: roles on admin_profiles + invite codes to join an existing tenant.
-- Phase: collaboration — lets more than one admin manage the same site.

-- ── Roles ───────────────────────────────────────────────────────────────────
-- Existing admins each created their own tenant, so they backfill as 'owner'.
-- 'member' admins are added later by redeeming an invite code.
ALTER TABLE admin_profiles
  ADD COLUMN role TEXT NOT NULL DEFAULT 'owner'
  CHECK (role IN ('owner', 'member'));

-- ── Invites ─────────────────────────────────────────────────────────────────
-- An admin generates a single-use code; a signed-up user redeems it to join the
-- tenant as an additional admin instead of creating their own site. Codes expire.
CREATE TABLE admin_invites (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code        TEXT        NOT NULL UNIQUE,
  email       TEXT,                        -- optional intended recipient (informational only)
  role        TEXT        NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  created_by  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  accepted_by UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_invites_tenant ON admin_invites(tenant_id);
CREATE INDEX idx_admin_invites_code   ON admin_invites(code);

-- The FastAPI backend reads/writes this table with the service_role key, which
-- bypasses RLS. Enable RLS with no policies so anon/user keys can never read
-- invite codes directly (matches the security model of the other tables).
ALTER TABLE admin_invites ENABLE ROW LEVEL SECURITY;
