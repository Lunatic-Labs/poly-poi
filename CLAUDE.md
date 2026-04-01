# PolyPOI

Config-driven, multi-tenant AI tour guide platform. Any point of interest spins up a branded visitor experience via QR code. Staff manage content through an admin portal; visitors interact via RAG-powered chatbot, interactive map, and recommendations.

## Stack

- **Backend**: Python 3.12 + FastAPI + SQLAlchemy async (asyncpg)
- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS + react-leaflet (Leaflet 1.9, pinned to react-leaflet v4 — v5 requires React 19)
- **Database**: Supabase (Postgres 17 + pgvector + Auth + Storage)
- **AI**: OpenAI GPT-4o (chat), text-embedding-3-small (vectors)
- **Hosting target**: Railway (single container) + Supabase cloud

## Structure

```
backend/app/
  core/           config, database session, auth (JWKS), tenant dependency
  models/         SQLAlchemy ORM: Tenant, AdminProfile, Stop, Route, Document, Amenity
  schemas/        Pydantic request/response models for each entity
  routers/        FastAPI routers: health, tenants, stops, routes, amenities, documents
  workers/        ARQ background tasks: ingest.py (doc extract → chunk → embed → pgvector)
frontend/src/
  lib/            supabase.ts (Supabase JS client), api.ts (fetch wrapper + auth headers)
  contexts/       AuthContext (Supabase session state)
  components/     ProtectedRoute, LocationPicker (Nominatim search + react-leaflet map)
  pages/admin/    Login, Onboarding (4-step wizard), Dashboard (3-tab content management)
    content/      StopsTab, DocumentsTab, AmenitiesTab
supabase/
  migrations/     SQL migrations — committed to git, applied with: make db-push
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

The document ingest pipeline requires an ARQ worker and Redis:

```sh
# Start Redis (Docker or local)
docker run -p 6379:6379 redis:7

# Run the ingest worker (from backend/)
cd backend && .venv/bin/arq app.workers.ingest.WorkerSettings
```

`REDIS_URL` defaults to `redis://localhost:6379`. Set it in `backend/.env.local` for non-default configs.

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
- **File uploads to Supabase Storage must go through the FastAPI backend**, not directly from the frontend. The frontend's anon-key JWT is blocked by storage RLS. The backend uses `service_role_key` via httpx to bypass it. See `POST /api/admin/tenants/me/logo` as the pattern.
- Use `api.postForm<T>(path, formData)` from `lib/api.ts` for multipart uploads — it attaches auth headers without setting `Content-Type` (browser sets the multipart boundary automatically)
- Supabase cloud issues **ES256** JWT access tokens (asymmetric). Backend verifies via JWKS endpoint (`/auth/v1/.well-known/jwks.json`), not the HS256 JWT secret. `SUPABASE_JWT_SECRET` is kept in config but not used for user token verification.
- All admin API routes use `get_tenant_id` from `core/tenant.py` — resolves `auth.users.id → admin_profiles.tenant_id`, raises 404 if no tenant.
- Document ingest: upload → Storage → `Document(status=pending)` → ARQ job enqueued. Worker: `pending → processing → ready|failed`. Frontend polls every 3s while any doc is in-flight.
- **Coordinate inputs use `LocationPicker`** (`components/LocationPicker.tsx`) — never add raw lat/lng text inputs. It provides Nominatim address search + draggable map preview and outputs `{ lat: number, lng: number }`.
- Stop photo upload follows the same httpx/Storage pattern as logo upload — see `POST /api/admin/stops/{id}/photo` in `routers/stops.py`.

## Additional Context

- `polypoi-design.md` — full architecture design doc; read before making structural changes
- `shared_notes/product_overview.md` — product summary; read for feature context
- `/Users/hunterphillips/.claude/plans/silly-conjuring-bee.md` — phased implementation plan (Phases 1–6)
