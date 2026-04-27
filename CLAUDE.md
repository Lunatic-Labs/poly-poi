# PolyPOI

Config-driven, multi-tenant AI tour guide platform. Any point of interest spins up a branded visitor experience via QR code. Staff manage content through an admin portal; visitors interact via RAG-powered chatbot, interactive map, and recommendations.

**Brand vs. internal name**: User-facing product is **"Low-Key Landmarks"**. Internal identifiers stay **"polypoi"** (repo, package names, localStorage key prefix `polypoi_<feature>_${slug}`, Nominatim User-Agent, env vars, `polypoi.com/app/...` URL placeholders). When editing UI copy, page titles, headings, or emails, use "Low-Key Landmarks".

## Stack

- **Backend**: Python 3.12 + FastAPI + SQLAlchemy async (asyncpg)
- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS + react-leaflet (Leaflet 1.9, pinned to react-leaflet v4 — v5 requires React 19)
- **Database**: Supabase (Postgres 17 + pgvector + Auth + Storage)
- **AI**: OpenAI GPT-4o (chat), text-embedding-3-small (vectors), gpt-4o-mini-transcribe (STT) • Hume.ai Octave (TTS + Voice Design)
- **Hosting**: Railway (API + ARQ worker + Redis) + Vercel (frontend) + Supabase cloud (DB + Auth + Storage)

## Structure

```
backend/app/
  core/           config, database session, auth (JWKS), tenant dependency (incl.
                  resolve_tenant_by_slug — shared by visitor + voice routers)
  models/         SQLAlchemy ORM: Tenant, AdminProfile, Stop, Route, Document, Amenity, VoiceCharacter
  schemas/        Pydantic request/response models — admin schemas + visitor.py (narrow public payloads)
  routers/        FastAPI routers: health, tenants, stops, routes, amenities, documents,
                  voice_characters (admin CRUD), voice (visitor STT/TTS proxies),
                  visitor (public slug-based reads), chat (SSE streaming)
  services/       query.py (RAG: intent classifier → structured handler or vector
                  retrieval → GPT-4o streaming; unanswered question logging),
                  hume.py (Voice Design + TTS streaming via httpx),
                  transcription.py (OpenAI gpt-4o-mini-transcribe wrapper)
  workers/        ARQ background tasks: ingest.py (doc extract → chunk → embed → pgvector)
frontend/src/
  lib/            supabase.ts, api.ts (auth'd admin fetch wrapper),
                  visitorApi.ts (unauthenticated visitor fetch + TS types),
                  audio.ts (MediaRecorder helper + transcribe/playTTS fetch wrappers)
  contexts/       AuthContext (Supabase session state)
  components/     ProtectedRoute, LocationPicker (Nominatim search + react-leaflet map),
                  VoicePicker (visitor voice character modal)
  pages/admin/    Login, Onboarding (4-step wizard), Dashboard (content tabs + settings)
    content/      StopsTab, RoutesTab, DocumentsTab, AmenitiesTab, VoicesTab, SettingsTab
  pages/visitor/  VisitorApp (shell + first-visit intro flow), ChatBot (incl. voice
                  controls when enabled), VisitorMap, Recommendations, AmenityLookup
supabase/
  migrations/     SQL migrations — committed to git, applied with: make db-push
infra/            Deployment config (Railway, Docker)
```

## Development

### Setup

```sh
make setup        # creates backend/.venv, installs Python + Node deps
cp .env.example .env.local  # fill in Supabase + OpenAI credentials (lives at project root)
```

Credentials come from Supabase dashboard → Settings → API (use legacy anon/service_role keys).

### Running

```sh
make backend      # FastAPI at http://localhost:8000 (loads .env.local from project root)
make frontend     # Vite at http://localhost:5173
```

The document ingest pipeline requires an ARQ worker and Redis:

```sh
# Start Redis (Docker or local)
docker run -p 6379:6379 redis:7

# Run the ingest worker (from backend/)
cd backend && .venv/bin/arq app.workers.ingest.WorkerSettings
```

`REDIS_URL` defaults to `redis://localhost:6379`. Set it in `.env.local` for non-default configs.

### Verification

```sh
curl localhost:8000/health    # → {"status":"ok","version":"0.1.0"}
make lint                     # ruff + eslint
make typecheck                # tsc --noEmit
make test-backend             # pytest (34 tests, ~0.1s)
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
- `.env.local` lives at the **project root** and is shared by backend and frontend. Backend: `backend/app/core/config.py` resolves it via an absolute path (works whether uvicorn launches from root or `backend/`). Frontend: `frontend/vite.config.ts` sets `envDir: ".."` so Vite reads root too. Vite still only exposes `VITE_`-prefixed vars to client code. Matches `make setup` and `docker-compose.yml`.
- Use `gen_random_uuid()` not `uuid_generate_v4()` in migrations (Postgres 17, no uuid-ossp needed)
- **File uploads to Supabase Storage must go through the FastAPI backend**, not directly from the frontend. The frontend's anon-key JWT is blocked by storage RLS. The backend uses `service_role_key` via httpx to bypass it. See `POST /api/admin/tenants/me/logo` as the pattern.
- Use `api.postForm<T>(path, formData)` from `lib/api.ts` for multipart uploads — it attaches auth headers without setting `Content-Type` (browser sets the multipart boundary automatically)
- Supabase cloud issues **ES256** JWT access tokens (asymmetric). Backend verifies via JWKS endpoint (`/auth/v1/.well-known/jwks.json`), not the HS256 JWT secret. `SUPABASE_JWT_SECRET` is kept in config but not used for user token verification.
- All admin API routes use `get_tenant_id` from `core/tenant.py` — resolves `auth.users.id → admin_profiles.tenant_id`, raises 404 if no tenant.
- Document ingest: upload → Storage → `Document(status=pending)` → ARQ job enqueued. Worker: `pending → processing → ready|failed`. Frontend polls every 3s while any doc is in-flight.
- **Coordinate inputs use `LocationPicker`** (`components/LocationPicker.tsx`) — never add raw lat/lng text inputs. It provides Nominatim address search + draggable map preview and outputs `{ lat: number, lng: number }`.
- Stop photo upload follows the same httpx/Storage pattern as logo upload — see `POST /api/admin/stops/{id}/photo` in `routers/stops.py`.
- **Visitor API routes** (`routers/visitor.py`) are public (no auth) and return narrow `VisitorTenantConfig / VisitorStop / VisitorAmenity / VisitorRoute` schemas from `schemas/visitor.py` — these strip `tenant_id`, budget columns, and admin timestamps. Never reuse admin `*Response` schemas on visitor endpoints. `VisitorTenantConfig` uses typed sub-models `VisitorBranding` and `VisitorEnabledModules` (not bare `dict`) for fields the visitor app branches logic on; `operating_hours` and `contact_info` remain `dict`.
- **Visitor router is registered last** in `main.py` (after all `/api/tenant/...` and `/api/admin/...` routers) — its broad `/{slug}/...` prefix would shadow more specific routes if registered earlier.
- **Chat SSE format**: `POST /api/{slug}/chat` accepts `{ message, session_id, history }`. `message` is capped at 1000 chars (`Field(max_length=1000)`). `history` is a list of `{ role: "user"|"assistant", content }` capped at 10 items — the frontend sends the last 10 messages from component state before each request. Streams `data: {"t": "<token>"}\n\n` per token, `data: {"done": true}\n\n` to close, `data: {"error": "..."}\n\n` on failure. Frontend uses `fetch` + `ReadableStream` (not `EventSource` — it doesn't support POST). Session ID is a `crypto.randomUUID()` stored in `sessionStorage`.
- **RAG query pipeline** (`services/query.py`): intent classifier (regex, no AI) routes hours/contact/amenity queries to structured DB handlers before touching OpenAI (structured queries ignore conversation history — they're stateless lookups). Unrecognized queries embed the message → pgvector cosine similarity (top-5 chunks, `tenant_id` filtered) → GPT-4o stream with conversation history included in the prompt. Unanswered questions are detected via response heuristics and logged to `unanswered_questions`. Token budget enforcement is deferred to Phase 6.
- **Visitor first-visit intro flow** (`pages/visitor/VisitorApp.tsx`): gated by `localStorage.getItem('polypoi_intro_done_${slug}')`. State machine: `"splash" → "picker" → "done"`. Tags selected in the interest picker are stored in `selectedTags: string[]` state (lifted to `VisitorApp`) and passed to `Recommendations` as `initialTags`. Use the same `polypoi_<feature>_${slug}` localStorage key pattern for any future per-slug visitor persistence.
- **`enabled_modules.recommendations`** gates both the Home screen explore card and the nav visibility — if you change how that flag behaves, update both the `HomeView` explore items array and any nav tab conditional in `VisitorApp.tsx`.
- **`enabled_modules.routes`** gates the visitor-side route chip row and polyline overlay in `VisitorMap.tsx` only — `VisitorApp.tsx` passes an empty `routes` array into the map when the flag is false. The admin **Routes** tab in `Dashboard.tsx` is always visible regardless; the flag controls visitor surfacing, not admin management. Routes reference stops via `stop_order: UUID[]` with no FK cascade, so `VisitorMap` filters out orphaned IDs defensively when resolving a route's stops.
- **`interest_tags` in the admin stop form** is `string[]` throughout — form state (`StopFormData.interest_tags: string[]`), the PATCH payload, and the API response all use arrays. The tag widget has a separate `tagInput: string` state for the in-progress input value. No join/split anywhere.
- **`VisitorMap` stop detail card** renders as `fixed z-[1000]` to appear above Leaflet (which occupies z-index ~400). Any new map overlays must use `z-[1000]` or higher to clear Leaflet's layer stack.
- **`DATABASE_URL` must use Supabase's transaction pooler** (`aws-0-<region>.pooler.supabase.com:6543`), not the deprecated direct host (`db.<ref>.supabase.co:5432` no longer resolves on IPv4). `core/database.py` is configured for this with `poolclass=NullPool` (Supabase pools on its end — double-pooling wastes pooler slots) and `connect_args={"statement_cache_size": 0}` (transaction pooler doesn't preserve prepared statements across queries; without this asyncpg errors mid-request). Don't change either without also reverting to direct or session pooler URL — the three settings are coupled.
- **Voice feature** (`routers/voice.py` + `routers/voice_characters.py` + `services/hume.py` + `services/transcription.py`):
  - **All Hume + STT calls proxy through the backend.** Browser never sees the Hume key. STT uses OpenAI's `gpt-4o-mini-transcribe`; TTS uses Hume Octave streaming.
  - **`enabled_modules.voice` is gated on BOTH frontend and backend.** UI-only gating would leak paid traffic — the visitor endpoints are public (slug-based), so anyone with a slug could otherwise generate billable Hume/OpenAI calls. `routers/voice.py:require_voice_enabled(tenant)` raises 403 when the flag is off; called from `GET /{slug}/voice-characters`, `POST /{slug}/voice/transcribe`, and `POST /{slug}/voice/tts`.
  - **Voice character authoring is two-step**: `POST /api/admin/voice-characters/design-preview` returns `{ generation_id, audio_base64, format }`; admin previews via `<audio src="data:audio/mp3;base64,...">`; on accept, frontend sends the held `generation_id` to `POST /api/admin/voice-characters` which calls Hume's save voice endpoint with a freshly-generated UUID as the voice name.
  - **`VoiceCharacter.hume_voice_id` stores Hume's voice *name* (a UUID we mint at save time), not Hume's internal id** — Hume references saved voices by name in TTS calls (`voice: { name, provider: "CUSTOM_VOICE" }`). Decoupling Hume name from admin display name means renames don't require Hume API calls.
  - **Voice character ownership is enforced at query level**: `POST /{slug}/voice/tts` filters `WHERE voice_character_id = X AND tenant_id = resolved.id` — visitors for tenant A cannot use tenant B's voices (returns 404).
  - **Router registration order** (`main.py`): `voice_characters` with admin routes; `voice` and `visitor` last (broad `/{slug}/...` patterns) — voice before visitor doesn't matter route-wise but visitor must remain last.
  - **One default voice per tenant** enforced by the unique partial index `idx_voice_characters_one_default_per_tenant` (`is_default = TRUE`). Set/update flows clear sibling defaults in the same transaction before flipping a new default on.
- **`resolve_tenant_by_slug(slug, db)`** lives in `core/tenant.py` and is shared by `routers/visitor.py` and `routers/voice.py`. Don't duplicate the slug→Tenant lookup in new public routers.

## Additional Context

- `polypoi-design.md` — full architecture design doc; read before making structural changes
- `shared_notes/product_overview.md` — product summary; read for feature context
- `/Users/hunterphillips/.claude/plans/silly-conjuring-bee.md` — phased implementation plan (Phases 1–6)
- `/Users/hunterphillips/.claude/plans/splendid-shimmying-snowglobe.md` — voice feature plan (Hume TTS + OpenAI STT)
