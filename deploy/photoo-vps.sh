#!/usr/bin/env bash
# =============================================================================
# Photoo — VPS Deployment Script (Standalone)
# Domain : app.photoo.in
# VPS    : 45.196.196.115
#
# Features
#   • Idempotent — safe to re-run at any time
#   • Change detection — only rebuilds Docker images when Dockerfile or
#     dependency lock files (requirements.txt / pnpm-lock.yaml) change.
#     Pure source-code pushes become a ~30 second container restart.
#   • DOCKER_BUILDKIT=1 — enables BuildKit cache mounts (pip + pnpm store)
#   • Base images pre-pulled in background while git syncs
#   • Smart health wait — exponential backoff, never polls faster than needed
#   • Caddy configured and reloaded only when config actually changed
#   • Installs `photoo-redeploy` convenience alias (run from anywhere on VPS)
#
# ── First-time deploy (fresh VPS) ────────────────────────────────────────────
#   ssh root@45.196.196.115
#   curl -fsSL https://raw.githubusercontent.com/shubhamshirve/CrewApp/main/deploy/photoo-vps.sh \
#        -o /tmp/photoo-deploy.sh
#   bash /tmp/photoo-deploy.sh
#
# ── Every subsequent deploy (after git push) ─────────────────────────────────
#   photoo-redeploy          ← alias installed automatically on first run
#   -- or --
#   cd /opt/photoo && bash deploy/photoo-vps.sh
# =============================================================================

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
REPO_URL="https://github.com/shubhamshirve/CrewApp.git"
DEPLOY_DIR="/opt/photoo"
DOMAIN="app.photoo.in"
CADDY_CONF="/etc/caddy/Caddyfile"
HASH_FILE="${DEPLOY_DIR}/.deploy_hashes"
REDEPLOY_BIN="/usr/local/bin/photoo-redeploy"

# Docker Compose v2 plugin command
DC="docker compose"

# ── Colours ───────────────────────────────────────────────────────────────────
GREEN="\033[92m"; YELLOW="\033[93m"; CYAN="\033[96m"; RED="\033[91m"
BOLD="\033[1m"; RESET="\033[0m"
ok()   { echo -e "  ${GREEN}✔${RESET}  $*"; }
info() { echo -e "  ${CYAN}→${RESET}  $*"; }
warn() { echo -e "  ${YELLOW}⚠${RESET}  $*"; }
err()  { echo -e "  ${RED}✘${RESET}  $*" >&2; exit 1; }
step() { echo -e "\n${BOLD}${CYAN}━━  $*  ${RESET}"; }

# ── Root check ────────────────────────────────────────────────────────────────
if [ "$(id -u)" -ne 0 ]; then
    err "Run as root:  sudo -i  then  bash /tmp/photoo-deploy.sh"
fi

START_TIME=$(date +%s)

echo -e ""
echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${CYAN}║   Photoo — VPS Deploy                       ║${RESET}"
echo -e "${BOLD}${CYAN}║   app.photoo.in  →  45.196.196.115          ║${RESET}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════╝${RESET}"
echo -e ""

# =============================================================================
step "0/9  Pre-flight checks"
# =============================================================================

# Git
command -v git >/dev/null 2>&1 || {
    info "Installing git..."
    apt-get update -qq && apt-get install -y -q git
}

# Python3 (secret generation and misc)
command -v python3 >/dev/null 2>&1 || {
    info "Installing python3..."
    apt-get install -y -q python3
}

# Docker
command -v docker >/dev/null 2>&1 || {
    err "Docker is required but not installed.
  Quick install:  curl -fsSL https://get.docker.com | sh && systemctl enable --now docker"
}

# Docker Compose v2 — auto-install if missing
if ! $DC version >/dev/null 2>&1; then
    info "Docker Compose v2 plugin not found — installing..."

    # Method 1: Try the docker-compose-plugin package (requires Docker's official apt repo)
    apt-get install -y -q docker-compose-plugin 2>/dev/null && \
        ok "docker-compose-plugin installed via apt" || {

        # Method 2: Download the binary directly from GitHub releases
        info "apt method failed — downloading compose binary from GitHub..."
        COMPOSE_VER_DL=$(curl -fsSL https://api.github.com/repos/docker/compose/releases/latest \
            | grep '"tag_name"' | cut -d'"' -f4)
        ARCH=$(uname -m)
        [ "$ARCH" = "aarch64" ] && ARCH="aarch64" || ARCH="x86_64"
        COMPOSE_BIN_URL="https://github.com/docker/compose/releases/download/${COMPOSE_VER_DL}/docker-compose-linux-${ARCH}"

        mkdir -p /usr/local/lib/docker/cli-plugins
        curl -fsSL "$COMPOSE_BIN_URL" -o /usr/local/lib/docker/cli-plugins/docker-compose
        chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

        $DC version >/dev/null 2>&1 \
            && ok "Docker Compose ${COMPOSE_VER_DL} installed from GitHub" \
            || err "Failed to install Docker Compose v2. Run manually:
  mkdir -p /usr/local/lib/docker/cli-plugins
  curl -fsSL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \\
       -o /usr/local/lib/docker/cli-plugins/docker-compose
  chmod +x /usr/local/lib/docker/cli-plugins/docker-compose"
    }
fi

# Warn if Compose < 2.24 (needed for !reset tag in docker-compose.prod.yml)
COMPOSE_VER=$($DC version --short 2>/dev/null || echo "0.0.0")
COMPOSE_MAJOR=$(echo "$COMPOSE_VER" | cut -d. -f1)
COMPOSE_MINOR=$(echo "$COMPOSE_VER" | cut -d. -f2)
if [ "${COMPOSE_MAJOR:-0}" -lt 2 ] || \
   { [ "${COMPOSE_MAJOR:-0}" -eq 2 ] && [ "${COMPOSE_MINOR:-0}" -lt 24 ]; }; then
    warn "Docker Compose $COMPOSE_VER detected — need >= 2.24 for prod overrides (!reset tag)."
    warn "Upgrade:  apt-get install -y docker-compose-plugin"
fi

# Enable BuildKit for all subsequent docker / compose calls
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# ── Enable BuildKit in Docker daemon.json (persistent, survives reboots) ─────
# DOCKER_BUILDKIT=1 env var alone is not reliable — some Compose versions
# ignore it and use the legacy builder, which doesn't understand --mount.
# Writing it into daemon.json is the only guaranteed method.
# This runs NOW in Step 0, BEFORE any docker build command, so BuildKit
# is definitely active when we reach Step 6.
DOCKER_DAEMON_JSON="/etc/docker/daemon.json"

BUILDKIT_IN_DAEMON=$(python3 -c "
import json, sys
try:
    with open('${DOCKER_DAEMON_JSON}') as f:
        d = json.load(f)
    sys.stdout.write('yes' if d.get('features', {}).get('buildkit') == True else 'no')
except Exception:
    sys.stdout.write('no')
" 2>/dev/null || echo "no")

if [ "$BUILDKIT_IN_DAEMON" != "yes" ]; then
    info "Configuring Docker daemon to use BuildKit (one-time setup)..."
    python3 - <<'PYEOF'
import json, os
path = "/etc/docker/daemon.json"
d = {}
if os.path.exists(path):
    try:
        with open(path) as f:
            d = json.load(f)
    except Exception:
        pass   # malformed JSON — start fresh
d.setdefault("features", {})["buildkit"] = True
with open(path, "w") as f:
    json.dump(d, f, indent=2)
print("  /etc/docker/daemon.json updated")
PYEOF

    systemctl reload-or-restart docker
    # Wait for daemon to come back up before proceeding
    for _i in 1 2 3 4 5 6 7 8 9 10; do
        sleep 2
        docker info >/dev/null 2>&1 && break
        info "  waiting for Docker daemon... (${_i})"
    done
    docker info >/dev/null 2>&1 || err "Docker daemon did not restart — check: journalctl -u docker -n 30"
    ok "Docker daemon restarted with BuildKit enabled"
else
    ok "Docker daemon BuildKit already configured"
fi

ok "Docker Compose $COMPOSE_VER  |  BuildKit enabled (env + daemon.json)"

# =============================================================================
step "1/9  Install Caddy on host (if missing)"
# =============================================================================
if command -v caddy &>/dev/null; then
    ok "Caddy already installed: $(caddy version | head -n1)"
else
    info "Installing Caddy via official apt repo..."
    apt-get install -y -q debian-keyring debian-archive-keyring \
        apt-transport-https curl gnupg lsb-release

    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
        | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg

    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
        | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null

    apt-get update -qq && apt-get install -y -q caddy
    systemctl enable caddy
    ok "Caddy installed: $(caddy version | head -n1)"
fi

# =============================================================================
step "2/9  Pre-pull base images (background — non-blocking)"
# =============================================================================
# These four pulls run in parallel with steps 3-5.
# 'wait' is called in step 6 before the build starts to ensure cache is warm.
info "Pulling base images concurrently in the background..."
(docker pull python:3.11-slim  >/dev/null 2>&1 && echo "  [bg] python:3.11-slim  ready") &
(docker pull node:20-alpine    >/dev/null 2>&1 && echo "  [bg] node:20-alpine    ready") &
(docker pull caddy:2-alpine    >/dev/null 2>&1 && echo "  [bg] caddy:2-alpine    ready") &
(docker pull mongo:4.4         >/dev/null 2>&1 && echo "  [bg] mongo:4.4         ready") &
ok "Background pulls started (will sync before build)"

# =============================================================================
step "3/9  Clone / update Photoo repo"
# =============================================================================
if [ -d "${DEPLOY_DIR}/.git" ]; then
    info "Pulling latest commits in ${DEPLOY_DIR}..."
    git -C "${DEPLOY_DIR}" pull --rebase --autostash
    COMMIT=$(git -C "${DEPLOY_DIR}" rev-parse --short HEAD)
    ok "Code updated  →  commit ${COMMIT}"
else
    info "Cloning ${REPO_URL} → ${DEPLOY_DIR}..."
    git clone "${REPO_URL}" "${DEPLOY_DIR}"
    COMMIT=$(git -C "${DEPLOY_DIR}" rev-parse --short HEAD)
    ok "Repo cloned  →  commit ${COMMIT}"
fi

cd "${DEPLOY_DIR}"

# =============================================================================
step "4/9  Generate backend/.env (first run only — never overwrites)"
# =============================================================================
if [ -f backend/.env ]; then
    ok "backend/.env already exists — leaving it untouched."
    info "  (Delete it and re-run to regenerate secrets: rm backend/.env)"
else
    JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")
    SEED_SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(24))")

    cat > backend/.env <<ENVEOF
# Auto-generated by photoo-vps.sh on $(date -u +"%Y-%m-%dT%H:%M:%SZ")
MONGO_URL=mongodb://mongodb:27017
DB_NAME=photoo_db
JWT_SECRET=${JWT_SECRET}
ENV=production
CORS_ORIGINS=https://${DOMAIN}
ADMIN_SEED_SECRET=${SEED_SECRET}
ADMIN_DEFAULT_PASSWORD=Admin@123
UPLOADS_DIR=/app/uploads

# Optional integrations — fill in as needed, then run: photoo-redeploy
# RAZORPAY_KEY_ID=
# RAZORPAY_KEY_SECRET=
# EMERGENT_LLM_KEY=
# RESEND_API_KEY=
# VAPID_PUBLIC_KEY=
# VAPID_PRIVATE_KEY=
# VAPID_CONTACT_EMAIL=admin@photoo.in
ENVEOF

    ok "backend/.env generated with fresh JWT_SECRET + ADMIN_SEED_SECRET"
    warn "Default admin password: Admin@123  — change it after first login!"
fi

# =============================================================================
step "5/9  Change detection — what needs to be rebuilt?"
# =============================================================================
#
# Hash the files that, when changed, require a Docker image rebuild:
#   backend  : Dockerfile  +  requirements.txt
#   frontend : Dockerfile  +  pnpm-lock.yaml
#
# Pure source-code changes (*.py, *.js, *.jsx …) do NOT need a rebuild —
# docker compose up -d picks them up via the running container restart.
#
compute_hash() {
    cat "$@" 2>/dev/null | md5sum | cut -d' ' -f1
}

BACKEND_HASH=$(compute_hash backend/Dockerfile backend/requirements.txt)
FRONTEND_HASH=$(compute_hash frontend/Dockerfile frontend/pnpm-lock.yaml)

# Load hashes persisted by the previous deploy run
PREV_BACKEND_HASH=""
PREV_FRONTEND_HASH=""
if [ -f "${HASH_FILE}" ]; then
    # shellcheck disable=SC1090
    source "${HASH_FILE}"
    PREV_BACKEND_HASH="${SAVED_BACKEND_HASH:-}"
    PREV_FRONTEND_HASH="${SAVED_FRONTEND_HASH:-}"
fi

REBUILD_BACKEND=false
REBUILD_FRONTEND=false

if [ "${BACKEND_HASH}" != "${PREV_BACKEND_HASH}" ]; then
    REBUILD_BACKEND=true
    warn "Backend  — Dockerfile / requirements.txt changed  →  image rebuild required"
else
    ok  "Backend  — deps unchanged  →  container restart only (fast!)"
fi

if [ "${FRONTEND_HASH}" != "${PREV_FRONTEND_HASH}" ]; then
    REBUILD_FRONTEND=true
    warn "Frontend — Dockerfile / pnpm-lock.yaml changed  →  image rebuild required"
else
    ok  "Frontend — deps unchanged  →  container restart only (fast!)"
fi

# Block until background pulls finish so the build cache is warm
info "Waiting for background image pulls to complete..."
wait
ok "Base images ready in local cache"

# =============================================================================
step "6/9  Build Docker images (only what changed)"
# =============================================================================
COMPOSE_FILES="-f docker-compose.yml -f docker-compose.prod.yml"

if $REBUILD_BACKEND && $REBUILD_FRONTEND; then
    info "Building backend + frontend (BuildKit handles parallelism)..."
    $DC $COMPOSE_FILES build backend frontend
    ok "Both images built"
elif $REBUILD_BACKEND; then
    info "Building backend only..."
    $DC $COMPOSE_FILES build backend
    ok "Backend image built"
elif $REBUILD_FRONTEND; then
    info "Building frontend only..."
    $DC $COMPOSE_FILES build frontend
    ok "Frontend image built"
else
    ok "No image rebuild needed — only a container restart will follow"
fi

# Persist new hashes for the next deploy run
cat > "${HASH_FILE}" <<HASHEOF
# Written by photoo-vps.sh on $(date -u +"%Y-%m-%dT%H:%M:%SZ")
SAVED_BACKEND_HASH="${BACKEND_HASH}"
SAVED_FRONTEND_HASH="${FRONTEND_HASH}"
HASHEOF
ok "Build hashes saved → ${HASH_FILE}"

# =============================================================================
step "7/9  Start / update containers"
# =============================================================================
$DC $COMPOSE_FILES up -d --remove-orphans
ok "Containers started (docker compose up -d)"

# ── Smart health wait (exponential backoff) ───────────────────────────────────
# Polls: 2s → 4s → 6s → 8s → 10s (cap) until healthy or timeout
wait_healthy() {
    local container=$1
    local label=$2
    local max_wait=${3:-120}
    local elapsed=0
    local sleep_sec=2

    info "Waiting for ${label} to become healthy (timeout: ${max_wait}s)..."

    while [ $elapsed -lt $max_wait ]; do
        STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "missing")

        case "$STATUS" in
            healthy)
                ok "${label} healthy  (${elapsed}s)"
                return 0 ;;
            unhealthy)
                warn "${label} UNHEALTHY — check: docker logs ${container} --tail 50"
                return 1 ;;
        esac

        sleep $sleep_sec
        elapsed=$((elapsed + sleep_sec))
        sleep_sec=$((sleep_sec < 10 ? sleep_sec + 2 : 10))
        info "  ${label}: ${STATUS}  (${elapsed}s elapsed)"
    done

    warn "${label} did not become healthy in ${max_wait}s"
    warn "  Inspect: docker logs ${container} --tail 50"
    return 1
}

wait_healthy photoo-mongodb "MongoDB"  60
wait_healthy photoo-backend  "Backend"  120

# =============================================================================
step "8/9  Configure host Caddy (app.photoo.in)"
# =============================================================================

# The Caddyfile content we want on disk
NEW_CADDYFILE='# /etc/caddy/Caddyfile
# Managed by photoo-vps.sh
# To edit:  nano /etc/caddy/Caddyfile
# To apply: caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy

{
    # Uncomment to receive Let'\''s Encrypt expiry notices:
    # email admin@photoo.in
    admin off
}

app.photoo.in {
    encode gzip zstd

    reverse_proxy 127.0.0.1:3000 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
        # Generous timeouts for file uploads and AI endpoints
        transport http {
            read_timeout  120s
            write_timeout 120s
        }
    }
}
'

mkdir -p /etc/caddy

# Compare meaningful content (strip blank lines + comment lines) to avoid
# unnecessary reloads on repeated runs
NEEDS_CADDY_UPDATE=true
if [ -f "$CADDY_CONF" ]; then
    CUR_SIG=$(grep -v '^\s*#' "$CADDY_CONF" | grep -v '^\s*$' | md5sum | cut -d' ' -f1)
    NEW_SIG=$(echo "$NEW_CADDYFILE" | grep -v '^\s*#' | grep -v '^\s*$' | md5sum | cut -d' ' -f1)
    [ "$CUR_SIG" = "$NEW_SIG" ] && NEEDS_CADDY_UPDATE=false
fi

if $NEEDS_CADDY_UPDATE; then
    # Back up existing Caddyfile
    if [ -f "$CADDY_CONF" ]; then
        BAK="${CADDY_CONF}.bak.$(date +%Y%m%d%H%M%S)"
        cp "$CADDY_CONF" "$BAK"
        info "Existing Caddyfile backed up → $BAK"
    fi

    printf '%s' "$NEW_CADDYFILE" > "$CADDY_CONF"
    ok "Caddyfile written → $CADDY_CONF"

    info "Validating Caddyfile..."
    caddy validate --config "$CADDY_CONF" --adapter caddyfile
    ok "Caddyfile valid"

    systemctl enable caddy
    systemctl restart caddy
    ok "Host Caddy restarted"
else
    ok "Caddyfile unchanged — skipping Caddy reload"
    # Make sure Caddy is running even if we skipped the reload
    systemctl is-active caddy >/dev/null 2>&1 || {
        systemctl start caddy
        ok "Host Caddy started"
    }
fi

# ── Firewall (ufw) — open 22, 80, 443 only ───────────────────────────────────
if command -v ufw &>/dev/null; then
    ufw allow 22/tcp  >/dev/null 2>&1 || true
    ufw allow 80/tcp  >/dev/null 2>&1 || true
    ufw allow 443/tcp >/dev/null 2>&1 || true
    ufw --force enable >/dev/null 2>&1 || true
    ok "UFW firewall: ports 22, 80, 443 open"
fi

# =============================================================================
step "9/9  Health check + install redeploy alias"
# =============================================================================

# ── Install one-command redeploy alias ───────────────────────────────────────
cat > "${REDEPLOY_BIN}" <<BINEOF
#!/usr/bin/env bash
# photoo-redeploy
# Pulls latest code from git and runs the smart deploy script.
# Only rebuilds Docker images when Dockerfile/deps actually changed.
set -euo pipefail
cd ${DEPLOY_DIR}
echo "Pulling latest commits..."
git pull --rebase --autostash
echo "Running deploy..."
exec bash deploy/photoo-vps.sh "\$@"
BINEOF
chmod +x "${REDEPLOY_BIN}"
ok "Installed: ${REDEPLOY_BIN}  (run 'photoo-redeploy' from anywhere on this VPS)"

sleep 3

echo ""
info "Running containers:"
docker ps --format "  {{.Names}}\t{{.Status}}" 2>/dev/null | grep -E "photoo|mongodb" || true

echo ""
info "Local HTTP probe:"
HTTP=$(curl -fsS -o /dev/null -w "%{http_code}" "http://127.0.0.1:3000" 2>/dev/null || echo "down")
echo "  http://127.0.0.1:3000  →  HTTP ${HTTP}"

echo ""
info "Host Caddy:"
systemctl is-active caddy >/dev/null 2>&1 \
    && ok "caddy active" \
    || warn "caddy not active — debug: journalctl -u caddy -n 50"

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${GREEN}║  Deployment complete in ${ELAPSED}s                  ║${RESET}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════╝${RESET}"
echo ""
echo -e "  Site:       ${BOLD}https://${DOMAIN}${RESET}"
echo -e "  App dir:    ${DEPLOY_DIR}"
echo ""
echo -e "  ${YELLOW}Next steps:${RESET}"
echo -e "  1. Verify DNS:  dig +short ${DOMAIN}  →  must return 45.196.196.115"
echo -e "  2. Seed demo data (optional):"
echo -e "       cd ${DEPLOY_DIR} && ${DC} -f docker-compose.yml -f docker-compose.prod.yml \\"
echo -e "            exec backend python /app/scripts/seed_data.py"
echo ""
echo -e "  ${YELLOW}Future redeployments (after every git push):${RESET}"
echo -e "  ${BOLD}photoo-redeploy${RESET}         — git pull + smart rebuild (only changed services)"
echo ""
echo -e "  ${YELLOW}Useful log commands:${RESET}"
echo -e "  All logs:    cd ${DEPLOY_DIR} && ${DC} -f docker-compose.yml -f docker-compose.prod.yml logs -f"
echo -e "  API logs:    cd ${DEPLOY_DIR} && ${DC} -f docker-compose.yml -f docker-compose.prod.yml logs -f backend"
echo -e "  Caddy logs:  journalctl -u caddy -f"
echo -e "  Restart:     cd ${DEPLOY_DIR} && ${DC} -f docker-compose.yml -f docker-compose.prod.yml restart"
echo ""
