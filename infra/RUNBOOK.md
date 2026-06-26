# Operations Runbook

Operational procedures for the deployed PolyPOI / Low-Key Landmarks stack.

## Hosting topology

| Service  | Platform      | Role                                                | Source        |
| -------- | ------------- | --------------------------------------------------- | ------------- |
| `api`    | Railway       | FastAPI app (public API)                            | repo `backend/` |
| `worker` | Railway       | ARQ consumer — document ingest (`ingest_document`)  | repo `backend/` |
| `Redis`  | Railway       | Job queue broker for ARQ (`redis:8.2.1`)            | `redis` image |
| frontend | Vercel        | React SPA (`poly-poi.vercel.app`)                   | repo `frontend/` |
| database | Supabase      | Postgres 17 + pgvector + Auth + Storage             | managed       |

Public API domain: `https://api-production-41b0.up.railway.app`
Health check: `GET /health` → `{"status":"ok","version":"0.1.0"}`

Dependency: **`worker` requires `Redis`** to be up first (connects to
`redis.railway.internal:6379` at startup; ARQ exits if it can't ping Redis).
`api` is independent of both.

---

## Symptom: dormant app — login fails, "CORS" errors in browser console

### What you'll see

```
Access to fetch at 'https://api-production-41b0.up.railway.app/...'
  blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present
GET https://api-production-41b0.up.railway.app/... net::ERR_FAILED
```

### Root cause

**This is not a CORS misconfiguration.** When the Railway project sits inactive
for a long period, Railway **wipes the service deployments** (the dashboard
shows "no deployment" or a `REMOVED` entry in deploy history). With no app
serving the domain, Railway's edge returns a fallback `404`:

```
server: railway-hikari
x-railway-fallback: true
{"status":"error","code":404,"message":"Application not found"}
```

A fallback response carries no CORS headers, so the browser reports it as a
CORS failure. The CORS errors are a **symptom of the API being absent** — fix
the deployment and they disappear. (Env vars, including `CORS_ORIGINS`, survive
dormancy; they do not need to be reset.)

This commonly coincides with Supabase also pausing the database for inactivity —
reactivate the Supabase project at supabase.com first.

### Diagnose

```sh
# Is the app actually serving, or is it the Railway fallback?
curl -s -i https://api-production-41b0.up.railway.app/health | head
#   x-railway-fallback: true   → service has NO deployment (dormant/wiped)
#   {"status":"ok",...} + 200  → app is up (look elsewhere)

railway status                      # confirm linked to PolyPOI / production
railway logs --service worker       # 'redis.railway.internal: Name or service
                                    #  not known' → Redis is down
```

### Recover

**Automated:** from the repo root, with the Railway CLI logged in and linked:

```sh
infra/wake.sh           # wakes Redis → worker → api, then verifies health + CORS
infra/wake.sh --check   # read-only: report current health, change nothing
```

**Manual**, in dependency order (Redis → worker → api):

1. **Redis** — image service; the CLI **cannot recreate** a wiped image
   deployment. In the dashboard: PolyPOI → production → `Redis` → Deploy (or
   `+ New → Database → Add Redis` if the service definition is gone). Wait for
   `ACTIVE`. If recreated fresh, confirm `api`/`worker` `REDIS_URL` point at the
   new instance (prefer a reference var `${{Redis.REDIS_URL}}`).
2. **worker** — `railway redeploy --service worker --yes`; if it reports
   "No deployment found", run `railway up --service worker --detach` from the
   repo root.
3. **api** — same pattern: `railway redeploy --service api --yes`, falling back
   to `railway up --service api --detach` from the repo root.

> `railway up` must run from the **repo root** (not `backend/`): it uploads the
> current directory and Railway applies each service's configured root directory
> (`backend/`) on top. Use `--detach` for scripts/CI so the call returns after
> upload instead of tailing build logs; omit it interactively to watch the build.

### Verify

```sh
curl -s https://api-production-41b0.up.railway.app/health      # {"status":"ok",...}
railway logs --service worker | grep redis_version             # worker ↔ Redis up
```

Then reload `https://poly-poi.vercel.app`, log in, and upload a test document —
it should move `pending → processing → ready` once the worker is consuming.

---

## Env vars that matter on `api` (Railway → service → Variables)

| Var                          | Note                                                              |
| ---------------------------- | ---------------------------------------------------------------- |
| `DATABASE_URL`               | **Transaction pooler** host `…pooler.supabase.com:6543`, not the direct `db.<ref>.supabase.co:5432` (no longer resolves on IPv4). |
| `CORS_ORIGINS`               | JSON list, e.g. `["https://poly-poi.vercel.app"]`. Default is localhost-only. |
| `REDIS_URL`                  | Points at the `Redis` service; ideally `${{Redis.REDIS_URL}}`.   |
| `OPENAI_API_KEY`, `HUME_API_KEY`, `SUPABASE_*` | Required at boot — `Settings()` is built at import; a single missing required field crash-loops startup. |
