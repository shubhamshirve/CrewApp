#!/usr/bin/env bash
# =============================================================================
# CrewBook + JVSapp — Unified VPS Deployment Script
#
# What this script does (idempotent, re-runnable):
#   1.  Installs Caddy on the host (if missing)
#   2.  Clones / updates JVSapp at  /opt/jvsapp
#   3.  Clones / updates CrewBook at /opt/crewbook
#   4.  Creates a NON-DESTRUCTIVE docker-compose.override.yml inside JVSapp
#       that remaps host 80→8080 and 443→8443 (so host Caddy can own 80/443).
#       JVSapp's own files are NEVER edited — the override is a separate file
#       that can be deleted to restore single-server defaults.
#   5.  Generates CrewBook backend/.env with random JWT_SECRET + ADMIN_SEED_SECRET
#   6.  Builds + starts both stacks with Docker Compose
#   7.  Writes a fresh /etc/caddy/Caddyfile that terminates TLS for both:
#         crew.mmpf.in  → 127.0.0.1:3000  (CrewBook frontend)
#         app.mmpf.in   → 127.0.0.1:8080  (JVSapp)
#   8.  Validates + reloads Caddy
#
# Run on the VPS as root:
#     curl -fsSL https://raw.githubusercontent.com/shubhamshirve/CrewApp/main/deploy/deploy.sh -o /tmp/deploy.sh
#     bash /tmp/deploy.sh
#
# Re-running is safe — every step checks before acting.
# =============================================================================

set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────────────
CREW_REPO="https://github.com/shubhamshirve/CrewApp.git"
JVS_REPO="https://github.com/shubhamshirve/JVSapp.git"
CREW_DIR="/opt/crewbook"
JVS_DIR="/opt/jvsapp"
CREW_DOMAIN="crew.mmpf.in"
JVS_DOMAIN="app.mmpf.in"
CADDY_CONF="/etc/caddy/Caddyfile"

# ── Colours ─────────────────────────────────────────────────────────────────
GREEN="\033[92m"; YELLOW="\033[93m"; CYAN="\033[96m"; RED="\033[91m"; BOLD="\033[1m"; RESET="\033[0m"
ok()   { echo -e "  ${GREEN}OK${RESET}    $*"; }
info() { echo -e "  ${CYAN}->${RESET}    $*"; }
warn() { echo -e "  ${YELLOW}WARN${RESET}  $*"; }
err()  { echo -e "  ${RED}FAIL${RESET}  $*"; }
step() { echo -e "\n${BOLD}${CYAN}── $* ${RESET}"; }

# ── Root check ──────────────────────────────────────────────────────────────
if [ "$(id -u)" -ne 0 ]; then err "Run as root (sudo or su -)"; exit 1; fi

echo -e "\n${BOLD}${CYAN}=================================================${RESET}"
echo -e "${BOLD}${CYAN} CrewBook + JVSapp  —  Unified VPS Deployment    ${RESET}"
echo -e "${BOLD}${CYAN}=================================================${RESET}"
echo -e "  Host Caddy domains:"
echo -e "    ${BOLD}${CREW_DOMAIN}${RESET} -> 127.0.0.1:3000  (CrewBook)"
echo -e "    ${BOLD}${JVS_DOMAIN}${RESET}  -> 127.0.0.1:8080  (JVSapp)"

# Ensure prerequisites
command -v git    >/dev/null || { apt-get update -qq && apt-get install -y git; }
command -v docker >/dev/null || { err "Docker is required but not installed. Aborting."; exit 1; }
command -v python3 >/dev/null || { apt-get install -y python3; }

# ─────────────────────────────────────────────────────────────────────────────
step "Step 1/8  Install Caddy (host)"
# ─────────────────────────────────────────────────────────────────────────────
if command -v caddy &>/dev/null; then
    ok "Caddy already installed: $(caddy version | head -n1)"
else
    info "Installing Caddy via official apt repo..."
    apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gnupg lsb-release
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
        | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
        | tee /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -qq && apt-get install -y caddy
    systemctl enable caddy
    ok "Caddy installed: $(caddy version | head -n1)"
fi

# ─────────────────────────────────────────────────────────────────────────────
step "Step 2/8  Clone / update JVSapp"
# ─────────────────────────────────────────────────────────────────────────────
if [ -d "$JVS_DIR/.git" ]; then
    info "Pulling latest in $JVS_DIR"
    git -C "$JVS_DIR" pull --rebase --autostash
    ok "JVSapp updated"
else
    info "Cloning $JVS_REPO -> $JVS_DIR"
    git clone "$JVS_REPO" "$JVS_DIR"
    ok "JVSapp cloned"
fi

# ─────────────────────────────────────────────────────────────────────────────
step "Step 3/8  Generate docker-compose.override.yml for JVSapp (non-destructive)"
# Compose merges this with the repo's docker-compose.yml at runtime; deleting
# the override restores the original (host 80/443) single-server behaviour.
# ─────────────────────────────────────────────────────────────────────────────
cd "$JVS_DIR"

# Stop any currently-running JVSapp containers before rewriting ports
if docker compose ps -q 2>/dev/null | grep -q . ; then
    info "Stopping existing JVSapp containers..."
    docker compose down --remove-orphans 2>/dev/null || true
fi

# Make sure PyYAML is available for the generator
python3 -c "import yaml" 2>/dev/null || pip3 install --quiet --break-system-packages pyyaml 2>/dev/null || apt-get install -y python3-yaml

python3 - <<'PYEOF'
import yaml, os, sys

src = "docker-compose.yml"
if not os.path.exists(src):
    print(f"  {src} not found in {os.getcwd()} — skipping override generation")
    sys.exit(0)

with open(src) as f:
    data = yaml.safe_load(f) or {}

services = data.get("services") or {}
to_remap = {}  # service_name -> [new port strings]

def remap_port(ps):
    """Return (new_port_str, did_remap)."""
    parts = ps.split(":")
    if len(parts) == 2:
        host, cont = parts
    elif len(parts) == 3:
        _, host, cont = parts
    elif len(parts) == 1:
        host = cont = parts[0]
    else:
        return ps, False
    if host == "80":
        return f"127.0.0.1:8080:{cont}", True
    if host == "443":
        return f"127.0.0.1:8443:{cont}", True
    return ps, False

for name, svc in services.items():
    if not isinstance(svc, dict):
        continue
    raw_ports = svc.get("ports") or []
    new_ports = []
    remapped = False
    for p in raw_ports:
        if isinstance(p, dict):
            # long-form port mapping
            hp = str(p.get("published", ""))
            cp = str(p.get("target", ""))
            if hp == "80":
                new_ports.append(f"127.0.0.1:8080:{cp}")
                remapped = True
            elif hp == "443":
                new_ports.append(f"127.0.0.1:8443:{cp}")
                remapped = True
            else:
                new_ports.append(p)
        else:
            ps = str(p).strip()
            new_p, did = remap_port(ps)
            new_ports.append(new_p)
            if did:
                remapped = True
    if remapped:
        to_remap[name] = new_ports

if not to_remap:
    print("  No service binds host 80/443 in JVSapp — no override needed.")
    # If a stale override exists from a previous run, leave it alone (idempotent).
    sys.exit(0)

header = [
    "# AUTO-GENERATED by CrewBook deploy.sh",
    "# Purpose:  free host ports 80 + 443 so the host Caddy can terminate TLS",
    "#           for both crew.mmpf.in and app.mmpf.in.",
    "# Safe to delete this file later if JVSapp is moved to its own server —",
    "# the original docker-compose.yml will then take over 80/443 again.",
    "#",
    "# Requires Docker Compose v2.24+ for the !override tag (Jan 2024).",
    "",
    "services:",
]
body = []
for svc, ports in to_remap.items():
    body.append(f"  {svc}:")
    body.append("    ports: !override")
    for p in ports:
        body.append(f'      - "{p}"')

with open("docker-compose.override.yml", "w") as f:
    f.write("\n".join(header + body) + "\n")

print(f"  Wrote docker-compose.override.yml — remapped services: {list(to_remap.keys())}")
PYEOF

ok "JVSapp override file ready (host 80->8080, 443->8443; original compose untouched)"

# Verify the user has a Compose version that supports !override (2.24+)
COMPOSE_VER=$(docker compose version --short 2>/dev/null || echo "0.0.0")
MAJOR=$(echo "$COMPOSE_VER" | cut -d. -f1)
MINOR=$(echo "$COMPOSE_VER" | cut -d. -f2)
if [ "${MAJOR:-0}" -lt 2 ] || { [ "${MAJOR:-0}" -eq 2 ] && [ "${MINOR:-0}" -lt 24 ]; }; then
    warn "Docker Compose $COMPOSE_VER may not support the !override tag (need >= 2.24)."
    warn "If 'docker compose up' fails, upgrade Docker, or remove the override and"
    warn "manually edit JVSapp's docker-compose.yml to bind ports 8080/8443."
fi

info "Starting JVSapp on 127.0.0.1:8080 + 127.0.0.1:8443 ..."
docker compose up -d
ok "JVSapp running"

# ─────────────────────────────────────────────────────────────────────────────
step "Step 4/8  Clone / update CrewBook"
# ─────────────────────────────────────────────────────────────────────────────
if [ -d "$CREW_DIR/.git" ]; then
    info "Pulling latest in $CREW_DIR"
    git -C "$CREW_DIR" pull --rebase --autostash
    ok "CrewBook updated"
else
    info "Cloning $CREW_REPO -> $CREW_DIR"
    git clone "$CREW_REPO" "$CREW_DIR"
    ok "CrewBook cloned"
fi
cd "$CREW_DIR"

# ─────────────────────────────────────────────────────────────────────────────
step "Step 5/8  Generate CrewBook backend/.env"
# ─────────────────────────────────────────────────────────────────────────────
if [ -f backend/.env ]; then
    warn "backend/.env already exists — leaving it untouched."
    warn "Delete it and re-run this script to regenerate secrets."
else
    JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")
    SEED_SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(24))")

    cat > backend/.env <<ENVEOF
# Auto-generated by deploy.sh on $(date -u +"%Y-%m-%dT%H:%M:%SZ")
MONGO_URL=mongodb://mongodb:27017
DB_NAME=crewbook_db
JWT_SECRET=${JWT_SECRET}
ENV=production
CORS_ORIGINS=https://${CREW_DOMAIN}
ADMIN_SEED_SECRET=${SEED_SECRET}
ADMIN_DEFAULT_PASSWORD=Admin@123
UPLOADS_DIR=/app/uploads

# Optional integrations — fill in before going live:
# RAZORPAY_KEY_ID=
# RAZORPAY_KEY_SECRET=
# EMERGENT_LLM_KEY=
# RESEND_API_KEY=
# VAPID_PUBLIC_KEY=
# VAPID_PRIVATE_KEY=
# VAPID_CONTACT_EMAIL=admin@${CREW_DOMAIN}
ENVEOF
    ok "Wrote backend/.env (JWT_SECRET + ADMIN_SEED_SECRET generated)"
fi

# ─────────────────────────────────────────────────────────────────────────────
step "Step 6/8  Build + start CrewBook stack"
# ─────────────────────────────────────────────────────────────────────────────
docker compose -f docker-compose.yml -f docker-compose.prod.yml down --remove-orphans 2>/dev/null || true
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
ok "CrewBook containers up"

info "Waiting for backend health (up to 60s)..."
for i in $(seq 1 12); do
    sleep 5
    STATUS=$(docker inspect --format='{{.State.Health.Status}}' crewbook-backend 2>/dev/null || echo "unknown")
    if [ "$STATUS" = "healthy" ]; then ok "Backend healthy"; break; fi
    info "  still waiting ($((i*5))s)  [status: $STATUS]"
done

# ─────────────────────────────────────────────────────────────────────────────
step "Step 7/8  Write host Caddyfile (fresh, both domains)"
# ─────────────────────────────────────────────────────────────────────────────
mkdir -p /etc/caddy
if [ -f "$CADDY_CONF" ]; then
    BAK="${CADDY_CONF}.bak.$(date +%Y%m%d%H%M%S)"
    cp "$CADDY_CONF" "$BAK"
    ok "Existing Caddyfile backed up -> $BAK"
fi

cat > "$CADDY_CONF" <<CADDYEOF
# /etc/caddy/Caddyfile
# Generated by CrewBook deploy.sh on $(date -u +"%Y-%m-%dT%H:%M:%SZ")
#
# This single host Caddy terminates TLS for BOTH apps while they share a VPS.
# When either app moves to its own server later, just remove its block from
# this file (or replace this file with the original) — no app code changes needed.

# Global options — auto-HTTPS via Let's Encrypt
{
    # Replace with a real email for ACME notices when ready:
    # email admin@mmpf.in
    admin off
}

# ── CrewBook ────────────────────────────────────────────────────────────────
${CREW_DOMAIN} {
    encode gzip zstd
    reverse_proxy 127.0.0.1:3000 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
        transport http {
            read_timeout  120s
            write_timeout 120s
        }
    }
}

# ── JVSapp ──────────────────────────────────────────────────────────────────
${JVS_DOMAIN} {
    encode gzip zstd
    reverse_proxy 127.0.0.1:8080 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}
CADDYEOF
ok "Caddyfile written -> $CADDY_CONF"

info "Validating Caddyfile..."
caddy validate --config "$CADDY_CONF" --adapter caddyfile

# Ensure no other container is holding 80/443
if ss -tlnp 2>/dev/null | grep -E ':(80|443)\s' | grep -v caddy >/dev/null; then
    warn "Something other than Caddy is listening on 80 or 443:"
    ss -tlnp | grep -E ':(80|443)\s' || true
    warn "You may need to stop that service before Caddy can bind 80/443."
fi

systemctl enable caddy
systemctl restart caddy
ok "Host Caddy restarted"

# ─────────────────────────────────────────────────────────────────────────────
step "Step 8/8  Final health check"
# ─────────────────────────────────────────────────────────────────────────────
sleep 4
echo ""
info "Running containers:"
docker ps --format "  {{.Names}}\t{{.Status}}" || true

echo ""
info "Caddy:"
systemctl is-active caddy >/dev/null && ok "caddy active" || warn "caddy not active — journalctl -u caddy -n 50"

echo ""
info "Local probes:"
curl -fsS -o /dev/null -w "  127.0.0.1:3000  -> HTTP %{http_code}\n" http://127.0.0.1:3000  || warn "127.0.0.1:3000 down"
curl -fsS -o /dev/null -w "  127.0.0.1:8080  -> HTTP %{http_code}\n" http://127.0.0.1:8080  || warn "127.0.0.1:8080 down"

echo ""
echo -e "${BOLD}${GREEN}=================================================${RESET}"
echo -e "${BOLD}${GREEN} Deployment complete                              ${RESET}"
echo -e "${BOLD}${GREEN}=================================================${RESET}"
echo -e "  CrewBook:  ${BOLD}https://${CREW_DOMAIN}${RESET}"
echo -e "  JVSapp:    ${BOLD}https://${JVS_DOMAIN}${RESET}"
echo ""
echo -e "  ${YELLOW}Next steps:${RESET}"
echo -e "  1. Verify DNS A records resolve to this VPS for both domains."
echo -e "  2. (Optional) Edit ${CADDY_CONF} and uncomment 'email admin@mmpf.in'"
echo -e "     for ACME notices, then 'systemctl reload caddy'."
echo -e "  3. Seed CrewBook demo data:"
echo -e "       cd ${CREW_DIR} && docker compose exec backend python /app/scripts/seed_data.py"
echo -e "  4. Add Razorpay / EMERGENT_LLM_KEY in ${CREW_DIR}/backend/.env, then:"
echo -e "       cd ${CREW_DIR} && docker compose -f docker-compose.yml -f docker-compose.prod.yml restart backend"
echo ""
echo -e "  ${YELLOW}To restore JVSapp's single-server setup later:${RESET}"
echo -e "     rm ${JVS_DIR}/docker-compose.override.yml"
echo -e "     cd ${JVS_DIR} && docker compose up -d"
echo -e "     (then point app.mmpf.in DNS at the new server)"
echo ""
