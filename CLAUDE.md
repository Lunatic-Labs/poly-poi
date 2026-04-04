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
  schemas/        Pydantic request/response models — admin schemas + visitor.py (narrow public payloads)
  routers/        FastAPI routers: health, tenants, stops, routes, amenities, documents,
                  visitor (public slug-based reads), chat (SSE streaming)
  services/       query.py — RAG query pipeline: intent classifier → structured handler or
                  vector retrieval → GPT-4o streaming; unanswered question logging
  workers/        ARQ background tasks: ingest.py (doc extract → chunk → embed → pgvector)
frontend/src/
  lib/            supabase.ts, api.ts (auth'd admin fetch wrapper),
                  visitorApi.ts (unauthenticated visitor fetch + TS types)
  contexts/       AuthContext (Supabase session state)
  components/     ProtectedRoute, LocationPicker (Nominatim search + react-leaflet map)
  pages/admin/    Login, Onboarding (4-step wizard), Dashboard (3-tab content management)
    content/      StopsTab, DocumentsTab, AmenitiesTab, SettingsTab
  pages/visitor/  VisitorApp (shell + first-visit intro flow), ChatBot, VisitorMap (map + StopCard overlay + stop list), Recommendations, AmenityLookup
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
make test-backend             # pytest (22 tests, ~0.1s)
make test-frontend            # vitest (4 tests)
make test                     # both
```

### Testing

Backend tests live in `backend/tests/`. Run from `backend/` with `.venv/bin/pytest`.

**Key patterns:**

- `backend/tests/conftest.py` sets dummy env vars at module level before any app imports — `Settings()` and `AsyncOpenAI()` run at import time in several modules, so this must come first
- Admin route tests override `get_db` and `get_tenant_id` together via `app.dependency_overrides` — overriding `get_tenant_id` directly skips both the JWT check and the AdminProfile DB lookup in one step
- `mock_db.refresh()` side effect populates `id`, `created_at`, `updated_at` — SQLAlchemy's Python-side `default=uuid.uuid4` and `server_default=func.now()` are never applied when commit is mocked
- Patch `enqueue_ingest` at `app.routers.documents.enqueue_ingest`, not at the source module — it's bound into the router's namespace at import time
- `pytest-httpx`'s `httpx_mock` fixture intercepts the handler's outbound `httpx.AsyncClient()` calls (e.g. Supabase Storage) without affecting the in-process `ASGITransport` test client

Frontend tests live in `frontend/src/pages/admin/__tests__/`. Run with `npm test`.

- Mock `AuthContext` at the module boundary (`vi.mock('../../../contexts/AuthContext')`) — this prevents `supabase.ts` from throwing on missing env vars, since the real `AuthContext` is never loaded
- `Login.tsx` inputs use `htmlFor`/`id` pairs — use `getByLabelText` to query them

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
- **Visitor API routes** (`routers/visitor.py`) are public (no auth) and return narrow `VisitorTenantConfig / VisitorStop / VisitorAmenity / VisitorRoute` schemas from `schemas/visitor.py` — these strip `tenant_id`, budget columns, and admin timestamps. Never reuse admin `*Response` schemas on visitor endpoints.
- **Visitor router is registered last** in `main.py` (after all `/api/tenant/...` and `/api/admin/...` routers) — its broad `/{slug}/...` prefix would shadow more specific routes if registered earlier.
- **Chat SSE format**: `POST /api/{slug}/chat` streams `data: {"t": "<token>"}\n\n` per token, `data: {"done": true}\n\n` to close, `data: {"error": "..."}\n\n` on failure. Frontend uses `fetch` + `ReadableStream` (not `EventSource` — it doesn't support POST). Session ID is a `crypto.randomUUID()` stored in `sessionStorage`.
- **RAG query pipeline** (`services/query.py`): intent classifier (regex, no AI) routes hours/contact/amenity queries to structured DB handlers before touching OpenAI. Unrecognized queries embed the message → pgvector cosine similarity (top-5 chunks, `tenant_id` filtered) → GPT-4o stream. Unanswered questions are detected via response heuristics and logged to `unanswered_questions`. Token budget enforcement is deferred to Phase 6.
- **Visitor first-visit intro flow** (`pages/visitor/VisitorApp.tsx`): gated by `localStorage.getItem('polypoi_intro_done_${slug}')`. State machine: `"splash" → "picker" → "done"`. Tags selected in the interest picker are stored in `selectedTags: string[]` state (lifted to `VisitorApp`) and passed to `Recommendations` as `initialTags`. Use the same `polypoi_<feature>_${slug}` localStorage key pattern for any future per-slug visitor persistence.
- **`enabled_modules.recommendations`** gates both the Home screen explore card and the nav visibility — if you change how that flag behaves, update both the `HomeView` explore items array and any nav tab conditional in `VisitorApp.tsx`.
- **`interest_tags` in the admin stop form** is `string[]` throughout — form state (`StopFormData.interest_tags: string[]`), the PATCH payload, and the API response all use arrays. The tag widget has a separate `tagInput: string` state for the in-progress input value. No join/split anywhere.
- **`VisitorMap` stop detail card** renders as `fixed z-[1000]` to appear above Leaflet (which occupies z-index ~400). Any new map overlays must use `z-[1000]` or higher to clear Leaflet's layer stack.

## Additional Context

- `polypoi-design.md` — full architecture design doc; read before making structural changes
- `shared_notes/product_overview.md` — product summary; read for feature context
- `/Users/hunterphillips/.claude/plans/silly-conjuring-bee.md` — phased implementation plan (Phases 1–6)
