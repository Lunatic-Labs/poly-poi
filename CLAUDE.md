# PolyPOI

Config-driven, multi-tenant AI tour guide platform. Points of interest (parks, museums, campuses) spin up a branded visitor experience via QR code. Staff manage content through an admin portal; visitors interact via RAG-powered chatbot, interactive map, and recommendations.

## Stack

- **Backend**: Python 3.12 + FastAPI + SQLAlchemy async (asyncpg)
- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS
- **Database**: Supabase (Postgres 17 + pgvector + Auth + Storage)
- **AI**: OpenAI GPT-4o (chat), text-embedding-3-small (vectors)
- **Hosting target**: Railway (single container) + Supabase cloud

## Structure

```
backend/          FastAPI app — routers, services, models
frontend/         React/Vite SPA — visitor app + admin portal (same codebase)
supabase/
  migrations/     SQL migrations — apply with: supabase db push
  config.toml     Supabase local config (Postgres 17)
infra/            Deployment config (Railway, Docker)
```

## Development

### Setup

```sh
make setup        # creates backend/.venv, installs Python + Node deps
cp .env.example backend/.env.local  # fill in Supabase + OpenAI credentials
```

Credentials come from Supabase dashboard → Settings → API (use legacy anon/service_role keys).

### Running

```sh
make backend      # FastAPI at http://localhost:8000 (from backend/.env.local)
make frontend     # Vite at http://localhost:5173
```

### Verification

```sh
curl localhost:8000/health    # → {"status":"ok","version":"0.1.0"}
make lint                     # ruff + eslint
make typecheck                # tsc --noEmit
```

### Database migrations

```sh
make db-push      # applies supabase/migrations/ to linked cloud project
                  # requires: supabase link --project-ref <ref>
```

## Key conventions

- Every DB query must filter by `tenant_id` — multi-tenancy is enforced at the application layer (FastAPI uses service_role key which bypasses RLS)
- `.env.local` lives in `backend/` (where uvicorn runs), not at root
- Use `gen_random_uuid()` not `uuid_generate_v4()` in migrations (Postgres 17, no uuid-ossp needed)

## Additional Context

- `polypoi-design.md` — full architecture design doc; read before making structural changes
- `shared_notes/product_overview.md` — product summary; read for feature context
- `/Users/hunterphillips/.claude/plans/silly-conjuring-bee.md` — phased implementation plan (Phases 1–6)
