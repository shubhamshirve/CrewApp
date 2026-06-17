#!/usr/bin/env bash
# =============================================================================
# CrewBook — Production Deployment Script
# Repo:   https://github.com/shubhamshirve/CrewApp
# Domain: crew.mmpf.in
# VPS:    45.196.196.114 (root)
#
# What this script does:
#   1. Installs Caddy on the VPS host (if not already installed)
#   2. Patches /opt/jvsapp so it no longer owns port 80/443
#      (moves it to localhost:8080 — app.mmpf.in still works via host Caddy)
#   3. Clones/updates CrewBook to /opt/crewbook
#   4. Creates backend/.env with a generated JWT_SECRET
#   5. Builds and starts Docker Compose (prod profile)
#   6. Installs the unified Caddy config and reloads Caddy
#   7. Optionally seeds demo data
#
# Usage:
#   scp deploy/deploy.sh root@45.196.196.114:/tmp/
#   ssh root@45.196.196.114 "bash /tmp/deploy.sh"
#
# Or one-liner from the VPS:
#   curl -sSL https://raw.githubusercontent.com/shubhamshirve/CrewApp/main/deploy/deploy.sh | bash
# =============================================================================

set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────────────
REPO="https://github.com/shubhamshirve/CrewApp.git"
DEPLOY_DIR="/opt/crewbook"
JVSAPP_DIR="/opt/jvsapp"
CREW_DOMAIN="crew.mmpf.in"
JVS_DOMAIN="app.mmpf.in"
CADDY_CONF="/etc/caddy/Caddyfile"

# ── Colours ─────────────────────────────────────────────────────────────────
GREEN="\033[92m"; YELLOW="\033[93m"; CYAN="\033[96m"; RED="\033[91m"; BOLD="\033[1m"; RESET="\033[0m"
ok()   { echo -e "  ${GREEN}✓${RESET}  $*"; }
info() { echo -e "  ${CYAN}→${RESET}  $*"; }
warn() { echo -e "  ${YELLOW}⚠${RESET}  $*"; }
err()  { echo -e "  ${RED}✗${RESET}  $*"; }
step() { echo -e "\n${BOLD}${CYAN}── $* ${RESET}"; }

# ── Root check ──────────────────────────────────────────────────────────────
if [ "$(id -u)" -ne 0 ]; then err "Run as root (sudo or su -)"; exit 1; fi

echo -e "\n${BOLD}${CYAN}╔══════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${CYAN}║  CrewBook — Production Deployment               ║${RESET}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════╝${RESET}"
echo -e "  Domain:  ${BOLD}${CREW_DOMAIN}${RESET}"
echo -e "  Dir:     ${BOLD}${DEPLOY_DIR}${RESET}"

# ─────────────────────────────────────────────────────────────────────────────
step "Step 1/7 — Install Caddy on host"
# ─────────────────────────────────────────────────────────────────────────────
if command -v caddy &>/dev/null; then
    ok "Caddy already installed: $(caddy version)"
else
    info "Installing Caddy via official apt repo…"
    apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gnupg lsb-release
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
        | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
        | tee /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -qq && apt-get install -y caddy
    systemctl enable caddy
    ok "Caddy installed: $(caddy version)"
fi

# ─────────────────────────────────────────────────────────────────────────────
step "Step 2/7 — Migrate jvsapp to port 8080 (free up port 80)"
# ─────────────────────────────────────────────────────────────────────────────
if [ ! -d "$JVSAPP_DIR" ]; then
    warn "$JVSAPP_DIR not found — skipping jvsapp migration"
else
    cd "$JVSAPP_DIR"

    # Determine which compose file is active
    COMPOSE_FILE="docker-compose.yml"
    [ -f docker-compose.prod.yml ] && COMPOSE_FILE="docker-compose.yml -f docker-compose.prod.yml"

    # Back up before modifying
    cp docker-compose.yml docker-compose.yml.bak
    ok "Backup: ${JVSAPP_DIR}/docker-compose.yml.bak"

    # Replace any "80:80" or "0.0.0.0:80:80" with "127.0.0.1:8080:80"
    # Also handle "443:443" → remove (host Caddy does TLS now)
    python3 - <<'PYEOF'
import re, sys
with open("docker-compose.yml") as f:
    content = f.read()
# Port 80 → 8080 (localhost bind)
content = re.sub(r'["\']?(?:0\.0\.0\.0:|\*:)?80:80["\']?', '"127.0.0.1:8080:80"', content)
# Remove 443:443 (host Caddy handles TLS)
content = re.sub(r'\s*-\s*["\']?(?:0\.0\.0\.0:|\*:)?443:443["\']?\n?', '\n', content)
with open("docker-compose.yml", "w") as f:
    f.write(content)
print("  docker-compose.yml patched")
PYEOF

    ok "jvsapp docker-compose.yml updated (80:80 → 127.0.0.1:8080:80)"

    # Restart jvsapp on new port
    info "Restarting jvsapp containers…"
    docker compose -f docker-compose.yml down --remove-orphans 2>/dev/null || true
    docker compose -f docker-compose.yml up -d
    ok "jvsapp restarted on localhost:8080"
fi

# ─────────────────────────────────────────────────────────────────────────────
step "Step 3/7 — Clone / update CrewBook repository"
# ─────────────────────────────────────────────────────────────────────────────
if [ -d "$DEPLOY_DIR/.git" ]; then
    info "Updating existing clone in $DEPLOY_DIR…"
    cd "$DEPLOY_DIR" && git pull --rebase
    ok "Repository updated"
else
    info "Cloning from $REPO…"
    git clone "$REPO" "$DEPLOY_DIR"
    ok "Cloned to $DEPLOY_DIR"
fi
cd "$DEPLOY_DIR"

# ─────────────────────────────────────────────────────────────────────────────
step "Step 4/7 — Create backend/.env (production)"
# ─────────────────────────────────────────────────────────────────────────────
if [ -f backend/.env ]; then
    warn "backend/.env already exists — leaving it untouched"
    warn "If you need to re-generate secrets, delete it and re-run this script"
else
    JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")
    SEED_SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(24))")

    cat > backend/.env <<ENVEOF
# Auto-generated by deploy.sh on $(date -u +"%Y-%m-%d %H:%M UTC")
# Review and update before production traffic

MONGO_URL=mongodb://mongodb:27017
DB_NAME=crewbook_db
JWT_SECRET=${JWT_SECRET}
ENV=production

# CORS — only allow your production domain
CORS_ORIGINS=https://${CREW_DOMAIN}

# Admin seed endpoint (keep this safe)
ADMIN_SEED_SECRET=${SEED_SECRET}
ADMIN_DEFAULT_PASSWORD=Admin@123

# Uploads
UPLOADS_DIR=/app/uploads

# ── Fill in the rest manually ────────────────────────────────────────────
# RAZORPAY_KEY_ID=rzp_live_xxxx
# RAZORPAY_KEY_SECRET=xxxx
# EMERGENT_LLM_KEY=sk-emergent-xxxx
# RESEND_API_KEY=re_xxxx
# VAPID_PUBLIC_KEY=
# VAPID_PRIVATE_KEY=
# VAPID_CONTACT_EMAIL=admin@crewbook.in
ENVEOF

    ok "backend/.env created with generated JWT_SECRET + ADMIN_SEED_SECRET"
    warn "Edit ${DEPLOY_DIR}/backend/.env to add RAZORPAY and other keys"
fi

# ─────────────────────────────────────────────────────────────────────────────
step "Step 5/7 — Build and start CrewBook containers"
# ─────────────────────────────────────────────────────────────────────────────
cd "$DEPLOY_DIR"
docker compose -f docker-compose.yml -f docker-compose.prod.yml down --remove-orphans 2>/dev/null || true
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
ok "CrewBook containers started"

# Brief wait for backend health check
info "Waiting for backend to become healthy (up to 60s)…"
for i in $(seq 1 12); do
    sleep 5
    STATUS=$(docker inspect --format='{{.State.Health.Status}}' crewbook-backend 2>/dev/null || echo "unknown")
    if [ "$STATUS" = "healthy" ]; then
        ok "Backend is healthy"
        break
    fi
    info "  Still waiting… ($((i*5))s) [status: $STATUS]"
done

# ─────────────────────────────────────────────────────────────────────────────
step "Step 6/7 — Install host Caddy config (both domains)"
# ─────────────────────────────────────────────────────────────────────────────
# Stop old Caddy service so we don't leave stale config
systemctl stop caddy 2>/dev/null || true

# Back up existing Caddyfile if present
if [ -f "$CADDY_CONF" ]; then
    cp "$CADDY_CONF" "${CADDY_CONF}.bak.$(date +%Y%m%d%H%M%S)"
    ok "Backed up existing Caddyfile → ${CADDY_CONF}.bak.*"
fi

cat > "$CADDY_CONF" <<CADDYEOF
# /etc/caddy/Caddyfile
# Auto-provisioned HTTPS for both apps on $(hostname)
# Generated by CrewBook deploy.sh on $(date -u +"%Y-%m-%d %H:%M UTC")

# ── Existing Jivdani app ─────────────────────────────────────────────────────
${JVS_DOMAIN} {
    encode gzip zstd
    reverse_proxy localhost:8080 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}

# ── CrewBook ─────────────────────────────────────────────────────────────────
${CREW_DOMAIN} {
    encode gzip zstd
    reverse_proxy localhost:3000 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
        # Long timeout for AI endpoints and file uploads
        transport http {
            read_timeout 120s
            write_timeout 120s
        }
    }
}
CADDYEOF

ok "Caddy config written to $CADDY_CONF"

# Validate and start Caddy
caddy validate --config "$CADDY_CONF"
systemctl start caddy && systemctl enable caddy
ok "Caddy started and enabled"

# ─────────────────────────────────────────────────────────────────────────────
step "Step 7/7 — Final health check"
# ─────────────────────────────────────────────────────────────────────────────
sleep 5

echo ""
info "Container status:"
docker ps --format "  {{.Names}}\t{{.Status}}" | grep -E "crewbook|mongodb" || true

echo ""
info "Caddy status:"
systemctl is-active caddy && echo "  Caddy is running" || echo "  Caddy is NOT running — check: journalctl -u caddy -n 30"

echo ""
info "Quick endpoint check:"
curl -sf http://localhost:3000 -o /dev/null && ok "localhost:3000 responds" || warn "localhost:3000 not responding yet"
curl -sf http://localhost:8080 -o /dev/null && ok "localhost:8080 (jvsapp) responds" || warn "localhost:8080 not responding"

echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${GREEN}║  ✓  Deployment complete!                        ║${RESET}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════╝${RESET}"
echo ""
echo -e "  ${CYAN}→${RESET} CrewBook: ${BOLD}https://${CREW_DOMAIN}${RESET}"
echo -e "  ${CYAN}→${RESET} Jivdani:  ${BOLD}https://${JVS_DOMAIN}${RESET}"
echo ""
echo -e "  ${YELLOW}Optional next steps:${RESET}"
echo -e "  1. Seed demo data:"
echo -e "     cd ${DEPLOY_DIR} && docker compose exec backend python /app/scripts/seed_data.py"
echo -e "  2. Add RAZORPAY / EMERGENT_LLM_KEY to ${DEPLOY_DIR}/backend/.env then restart:"
echo -e "     cd ${DEPLOY_DIR} && docker compose -f docker-compose.yml -f docker-compose.prod.yml restart backend"
echo -e "  3. Check logs:"
echo -e "     docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f"
echo ""
