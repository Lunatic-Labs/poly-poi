#!/usr/bin/env bash
#
# wake.sh — bring the PolyPOI Railway stack back up after dormancy.
#
# When the Railway project goes inactive for a long time, its deployments get
# wiped (services show "no deployment" / "REMOVED"). Env vars survive, so
# recovery is just recreating deployments in dependency order:
#
#     Redis  →  worker  →  api
#
#   - Redis  : image service (redis:8.2.1). If its deployment was REMOVED, the
#              CLI cannot recreate it — that requires the dashboard. The script
#              detects this and prints instructions instead of failing silently.
#   - worker : source-built ARQ consumer. Depends on Redis resolving at
#              redis.railway.internal. `railway up` (or redeploy) recreates it.
#   - api    : source-built FastAPI app, independent of the others.
#
# The browser-side "CORS / Access-Control-Allow-Origin missing" errors are a
# SYMPTOM of the api service being absent, not a CORS misconfig. Once api is
# serving, the CORS headers come back automatically.
#
# Usage:
#     infra/wake.sh            # wake everything + verify
#     infra/wake.sh --check    # verify only, change nothing
#
# Requires: railway CLI, logged in (`railway login`) and linked to the
# PolyPOI / production project (`railway link`).

set -euo pipefail

# ---- config (override via env) ----------------------------------------------
HEALTH_URL="${HEALTH_URL:-https://api-production-41b0.up.railway.app/health}"
CORS_ORIGIN="${CORS_ORIGIN:-https://poly-poi.vercel.app}"
API_SERVICE="${API_SERVICE:-api}"
WORKER_SERVICE="${WORKER_SERVICE:-worker}"
REDIS_SERVICE="${REDIS_SERVICE:-Redis}"

REPO_ROOT="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
ok()   { printf '\033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '\033[33m!\033[0m %s\n' "$*"; }
err()  { printf '\033[31m✗\033[0m %s\n' "$*"; }

# ---- preflight --------------------------------------------------------------
command -v railway >/dev/null || { err "railway CLI not installed (brew install railway)"; exit 1; }
railway whoami >/dev/null 2>&1 || { err "Not logged in. Run: railway login"; exit 1; }
if ! railway status 2>/dev/null | grep -q "PolyPOI"; then
  err "Not linked to PolyPOI. Run: railway link  (pick PolyPOI / production)"; exit 1
fi

CHECK_ONLY=0
[[ "${1:-}" == "--check" ]] && CHECK_ONLY=1

# ---- health helpers ---------------------------------------------------------
api_healthy() {
  curl -fsS -m 10 "$HEALTH_URL" 2>/dev/null | grep -q '"status":"ok"'
}

wait_for_api() {
  bold "Waiting for api /health ..."
  for i in $(seq 1 24); do                 # ~6 min max
    if api_healthy; then ok "api healthy → $(curl -fsS -m 10 "$HEALTH_URL")"; return 0; fi
    printf '  [%3ds] not up yet\n' "$((i*15))"
    sleep 15
  done
  err "api did not become healthy in time — check: railway logs --service $API_SERVICE"
  return 1
}

verify_cors() {
  bold "Verifying CORS for $CORS_ORIGIN ..."
  local hdr
  hdr=$(curl -fsS -m 10 -X OPTIONS "${HEALTH_URL%/health}/api/admin/tenants/me" \
    -H "Origin: $CORS_ORIGIN" \
    -H "Access-Control-Request-Method: GET" \
    -H "Access-Control-Request-Headers: authorization" -D - -o /dev/null 2>/dev/null \
    | grep -i "access-control-allow-origin" || true)
  if [[ -n "$hdr" ]]; then ok "CORS: $hdr"; else warn "No allow-origin header — check CORS_ORIGINS env var on api"; fi
}

verify_worker() {
  bold "Checking worker connected to Redis ..."
  if railway logs --service "$WORKER_SERVICE" 2>/dev/null | tail -20 | grep -qi "redis_version"; then
    ok "worker connected: $(railway logs --service "$WORKER_SERVICE" 2>/dev/null | grep -i redis_version | tail -1)"
  else
    warn "worker not confirmed connected — inspect: railway logs --service $WORKER_SERVICE"
  fi
}

if [[ "$CHECK_ONLY" == "1" ]]; then
  bold "=== check only ==="
  api_healthy && ok "api healthy" || err "api DOWN"
  verify_cors
  verify_worker
  exit 0
fi

# ---- recover a source-built service (api / worker) --------------------------
# Prefer redeploy (restarts existing deployment, no upload). If the deployment
# was wiped ("No deployment found"), fall back to `railway up` from repo root
# so the service's configured root directory (backend/) resolves correctly.
recover_source_service() {
  local svc="$1"
  bold "Recovering source service: $svc"
  if railway redeploy --service "$svc" --yes 2>&1 | tee /dev/stderr | grep -qi "No deployment found"; then
    warn "$svc has no deployment — creating one with railway up"
    ( cd "$REPO_ROOT" && railway up --service "$svc" --detach )
    ok "$svc deploy triggered"
  else
    ok "$svc redeploy triggered"
  fi
}

# ---- Redis (image service) --------------------------------------------------
recover_redis() {
  bold "Recovering Redis: $REDIS_SERVICE"
  if railway redeploy --service "$REDIS_SERVICE" --yes 2>&1 | grep -qi "No deployment found"; then
    err "Redis deployment was REMOVED — the CLI cannot recreate an image service."
    cat <<EOF

  Recreate it in the dashboard, then re-run this script:
    1. Railway → PolyPOI → production → $REDIS_SERVICE service
    2. Deploy the existing service, OR if its definition is gone:
       + New → Database → Add Redis
    3. If recreated fresh, confirm api & worker REDIS_URL point at the new
       instance (ideally via reference var \${{$REDIS_SERVICE.REDIS_URL}}).
    4. Wait for ACTIVE, then: infra/wake.sh

EOF
    exit 1
  fi
  ok "Redis redeploy triggered"
}

# ---- run, in dependency order -----------------------------------------------
bold "PolyPOI wake-up — Redis → worker → api"
recover_redis
recover_source_service "$WORKER_SERVICE"
recover_source_service "$API_SERVICE"

wait_for_api
verify_cors
verify_worker

bold "=== done ==="
echo "Reload $CORS_ORIGIN and log in. Test a document upload to confirm ingest (pending → ready)."
