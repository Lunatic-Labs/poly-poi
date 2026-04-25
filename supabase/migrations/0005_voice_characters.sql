-- Voice characters: per-tenant TTS personas authored via Hume Voice Design.
-- Visitors pick from this list when voice mode is enabled.

CREATE TABLE voice_characters (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  description     TEXT,                              -- the Voice Design prompt, kept for visitor display
  hume_voice_id   TEXT        NOT NULL,              -- Hume's saved voice resource ID
  is_default      BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_voice_characters_tenant_id ON voice_characters(tenant_id);

-- Only one default character per tenant.
CREATE UNIQUE INDEX idx_voice_characters_one_default_per_tenant
  ON voice_characters(tenant_id)
  WHERE is_default = TRUE;

CREATE TRIGGER voice_characters_updated_at
  BEFORE UPDATE ON voice_characters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE voice_characters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_voice_characters" ON voice_characters FOR SELECT USING (true);
