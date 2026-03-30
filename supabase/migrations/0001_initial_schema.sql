-- PolyPOI Initial Schema
-- Phase 1: Complete data model foundation

-- Extensions
-- gen_random_uuid() is built into Postgres 13+ — no uuid-ossp extension needed
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================================
-- TENANTS
-- ============================================================
CREATE TABLE tenants (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT        UNIQUE NOT NULL,
  name          TEXT        NOT NULL,
  -- branding: { primary_color, accent_color, logo_url, welcome_text, tone_preset }
  branding      JSONB       NOT NULL DEFAULT '{}',
  -- enabled_modules: { chatbot, map, recommendations }
  -- amenity_lookup is always on and not toggled here
  enabled_modules JSONB     NOT NULL DEFAULT '{"chatbot": true, "map": true, "recommendations": true}',
  -- operating_hours: { monday: { open, close }, ... } or { default: { open, close } }
  operating_hours JSONB     NOT NULL DEFAULT '{}',
  -- contact_info: { phone, email, address, emergency_phone }
  contact_info  JSONB       NOT NULL DEFAULT '{}',
  -- optional per-tenant AI cost controls
  monthly_token_budget INTEGER,
  tokens_used_this_month INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ADMIN PROFILES (extends Supabase auth.users)
-- ============================================================
CREATE TABLE admin_profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TOUR STOPS
-- ============================================================
CREATE TABLE stops (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  description   TEXT,
  lat           DOUBLE PRECISION NOT NULL,
  lng           DOUBLE PRECISION NOT NULL,
  category      TEXT        NOT NULL DEFAULT 'landmark'
                CHECK (category IN ('exhibit', 'trailhead', 'building', 'landmark', 'other')),
  interest_tags TEXT[]      NOT NULL DEFAULT '{}',
  photo_urls    TEXT[]      NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ROUTES (ordered stop sequences)
-- ============================================================
CREATE TABLE routes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  description TEXT,
  stop_order  UUID[]      NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- KNOWLEDGE DOCUMENTS
-- ============================================================
CREATE TABLE documents (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  filename      TEXT        NOT NULL,
  storage_path  TEXT        NOT NULL,
  mime_type     TEXT,
  status        TEXT        NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'processing', 'ready', 'failed')),
  token_count   INTEGER,
  chunk_count   INTEGER,
  error_message TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- DOCUMENT CHUNKS (RAG — vectors stored here)
-- ============================================================
CREATE TABLE document_chunks (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  document_id   UUID        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  content       TEXT        NOT NULL,
  embedding     vector(1536),           -- text-embedding-3-small dimensions
  chunk_index   INTEGER     NOT NULL,
  token_count   INTEGER     NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- AMENITIES
-- ============================================================
CREATE TABLE amenities (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  type        TEXT        NOT NULL
              CHECK (type IN ('restroom', 'food', 'parking', 'emergency', 'gift', 'partner', 'other')),
  lat         DOUBLE PRECISION NOT NULL,
  lng         DOUBLE PRECISION NOT NULL,
  hours       JSONB       NOT NULL DEFAULT '{}',
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- UNANSWERED QUESTIONS (for admin dashboard content gap report)
-- ============================================================
CREATE TABLE unanswered_questions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  question    TEXT        NOT NULL,
  asked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ANALYTICS EVENTS
-- ============================================================
CREATE TABLE analytics_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_id  TEXT        NOT NULL,   -- anonymous, from sessionStorage
  event_type  TEXT        NOT NULL,   -- 'session_start' | 'chat_message' | 'stop_viewed' | 'map_interaction' | 'module_used'
  metadata    JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_stops_tenant_id             ON stops(tenant_id);
CREATE INDEX idx_routes_tenant_id            ON routes(tenant_id);
CREATE INDEX idx_documents_tenant_id         ON documents(tenant_id);
CREATE INDEX idx_documents_status            ON documents(tenant_id, status);
CREATE INDEX idx_document_chunks_tenant_id   ON document_chunks(tenant_id);
CREATE INDEX idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX idx_amenities_tenant_id         ON amenities(tenant_id);
CREATE INDEX idx_amenities_type              ON amenities(tenant_id, type);
CREATE INDEX idx_unanswered_questions_tenant ON unanswered_questions(tenant_id, asked_at DESC);
CREATE INDEX idx_analytics_events_tenant     ON analytics_events(tenant_id);
CREATE INDEX idx_analytics_events_created_at ON analytics_events(created_at);
CREATE INDEX idx_admin_profiles_tenant_id    ON admin_profiles(tenant_id);

-- HNSW vector index for fast cosine similarity search.
-- Queries must always filter by tenant_id after retrieval.
CREATE INDEX idx_document_chunks_embedding ON document_chunks
  USING hnsw (embedding vector_cosine_ops);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tenants_updated_at   BEFORE UPDATE ON tenants   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER stops_updated_at     BEFORE UPDATE ON stops     FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER routes_updated_at    BEFORE UPDATE ON routes    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER documents_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER amenities_updated_at BEFORE UPDATE ON amenities FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
-- The FastAPI backend uses the service_role key which bypasses RLS.
-- These policies secure direct Supabase client access (e.g., admin portal
-- using the anon/user key for reads, and future direct client calls).

ALTER TABLE tenants              ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE stops                ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents            ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE amenities            ENABLE ROW LEVEL SECURITY;
ALTER TABLE unanswered_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events     ENABLE ROW LEVEL SECURITY;

-- Visitor app: public read for display data (tenant config, stops, routes, amenities)
CREATE POLICY "public_read_tenants"   ON tenants   FOR SELECT USING (true);
CREATE POLICY "public_read_stops"     ON stops     FOR SELECT USING (true);
CREATE POLICY "public_read_routes"    ON routes    FOR SELECT USING (true);
CREATE POLICY "public_read_amenities" ON amenities FOR SELECT USING (true);

-- Admin write: scoped to authenticated user's tenant (enforced in Phase 2)
-- Placeholder — full policies added when auth is wired in Phase 2
CREATE POLICY "admin_manage_own_tenant" ON tenants
  FOR ALL USING (
    id IN (SELECT tenant_id FROM admin_profiles WHERE id = auth.uid())
  );
