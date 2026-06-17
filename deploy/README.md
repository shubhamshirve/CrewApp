# Photoo + JVSapp — Unified VPS Deployment Guide

**VPS:** `45.196.196.114` (root)
**Photoo:** `https://photoo.in`
**JVSapp:**   `https://app.mmpf.in`

> **Why a single deploy script?**
> Both apps will live on this VPS for the next 2–3 months, then move to dedicated servers.
> The setup below is **non-destructive** for both repos:
> – No file inside either app's repo is edited.
> – JVSapp's port re-mapping is done via a separate `docker-compose.override.yml`.
> – Removing that one file restores each app's original "deploy anywhere" defaults.

---

## Prerequisites

- [x] Root SSH access to the VPS
- [x] Docker + Docker Compose ≥ 2.24 installed (already present per user)
- [x] DNS A records:
  - `photoo.in` → `45.196.196.114`
  - `app.mmpf.in`  → `45.196.196.114`
- [x] Both repos public:
  - `https://github.com/shubhamshirve/CrewApp`
  - `https://github.com/shubhamshirve/JVSapp`

---

## One-Command Deploy

```bash
ssh root@45.196.196.114
curl -fsSL https://raw.githubusercontent.com/shubhamshirve/CrewApp/main/deploy/deploy.sh -o /tmp/deploy.sh
bash /tmp/deploy.sh
```

The script is **idempotent** — safe to re-run after fixes / updates.

---

## What the script does (8 steps, ~10 min)

| # | Step | Effect |
|---|------|--------|
| 1 | Install host Caddy | Auto-HTTPS reverse proxy on :80/:443 |
| 2 | Clone/update `/opt/jvsapp` | Original repo, untouched |
| 3 | Write `/opt/jvsapp/docker-compose.override.yml` | Remaps host **80→8080**, **443→8443** using the Compose `!override` tag — original `docker-compose.yml` is *not edited* |
| 4 | Clone/update `/opt/photoo` | Original repo, untouched |
| 5 | Generate `/opt/photoo/backend/.env` | Random `JWT_SECRET` + `ADMIN_SEED_SECRET` |
| 6 | `docker compose up -d --build` (prod overrides) | Frontend on `127.0.0.1:3000` only |
| 7 | Write fresh `/etc/caddy/Caddyfile` | Both domains TLS-terminated |
| 8 | Health check | curl probes + container status |

---

## Architecture

```
                          Internet  ─ HTTPS ─►  45.196.196.114
                                                     │
                                                     ▼
                                        ┌────────────────────────┐
                                        │  Host Caddy  :80 :443  │  /etc/caddy/Caddyfile
                                        │  photoo.in → :3000  │
                                        │  app.mmpf.in  → :8080  │
                                        └───────┬────────────┬───┘
                                                │            │
                       127.0.0.1:3000 ◄─────────┘            └────────►  127.0.0.1:8080
                              │                                                    │
                ┌─────────────▼─────────────┐                  ┌──────────────────▼──────────────────┐
                │  /opt/photoo            │                  │  /opt/jvsapp                        │
                │  Frontend (Caddy)         │                  │  docker-compose.yml (UNTOUCHED)     │
                │  Backend (FastAPI)        │                  │  + docker-compose.override.yml      │
                │  MongoDB 4.4 (internal)   │                  │  (host 80→8080, 443→8443)           │
                └───────────────────────────┘                  └─────────────────────────────────────┘
```

---

## Manual install (skip the script)

### 1. Install Caddy
```bash
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gnupg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    | tee /etc/apt/sources.list.d/caddy-stable.list
apt-get update && apt-get install -y caddy && systemctl enable caddy
```

### 2. Set up JVSapp (non-destructive port remap)
```bash
git clone https://github.com/shubhamshirve/JVSapp.git /opt/jvsapp
cd /opt/jvsapp

cat > docker-compose.override.yml <<'EOF'
# Temporary co-hosting override — delete to restore original ports
services:
  caddy:                        # ← if JVSapp's web service is named differently, change this
    ports: !override
      - "127.0.0.1:8080:80"
      - "127.0.0.1:8443:443"
EOF

docker compose up -d
```
> The script auto-detects the correct service name by parsing JVSapp's `docker-compose.yml`. Use the manual approach only if the script reports a problem.

### 3. Set up Photoo
```bash
git clone https://github.com/shubhamshirve/CrewApp.git /opt/photoo
cd /opt/photoo
cp deploy/env.production.example backend/.env   # then edit JWT_SECRET etc.
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

### 4. Install host Caddyfile
```bash
cp /opt/photoo/deploy/caddy-vps.conf /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile
systemctl restart caddy
```

### 5. Seed demo data (optional)
```bash
cd /opt/photoo && docker compose exec backend python /app/scripts/seed_data.py
```

---

## Moving one of the apps to its own server later

Because the override is the *only* shared-server artefact, decommissioning is trivial:

### Move JVSapp to its own VPS
```bash
# On the old shared VPS:
rm /opt/jvsapp/docker-compose.override.yml   # back to "host 80/443" defaults
# Then delete the app.mmpf.in block from /etc/caddy/Caddyfile and `systemctl reload caddy`

# On the new VPS:
git clone https://github.com/shubhamshirve/JVSapp.git /opt/jvsapp && cd /opt/jvsapp
docker compose up -d                          # works exactly as designed in the repo
```

### Move Photoo to its own VPS
```bash
# On the new VPS, use the standard Photoo flow:
git clone https://github.com/shubhamshirve/CrewApp.git /opt/photoo && cd /opt/photoo
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
# Then either deploy a dedicated Caddy with just the photoo.in block,
# or let the frontend container's internal Caddy own :80 / :443.
```

---

## Day-2 operations

```bash
# Update Photoo
cd /opt/photoo && git pull && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Update JVSapp
cd /opt/jvsapp && git pull && docker compose up -d

# Tail logs
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f                   # Photoo
docker compose -f /opt/jvsapp/docker-compose.yml logs -f                                  # JVSapp
journalctl -u caddy -f                                                                    # Host Caddy

# Reload Caddy after Caddyfile edit
caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy
```

---

## Troubleshooting

| Symptom | Probable cause | Fix |
|---|---|---|
| `caddy: bind: address already in use` on :80/:443 | JVSapp container still binding host 80 | Confirm `/opt/jvsapp/docker-compose.override.yml` exists; `cd /opt/jvsapp && docker compose up -d --force-recreate` |
| TLS cert not issued | DNS not yet propagated | `dig +short photoo.in app.mmpf.in` — both must return `45.196.196.114` |
| `502 Bad Gateway` from Caddy | Backing container down | `docker ps` — restart the failing service |
| Photoo frontend loads, `/api/*` fails | CORS mismatch | Ensure `CORS_ORIGINS=https://photoo.in` in `/opt/photoo/backend/.env`, then restart backend |
| Compose error `unknown tag !override` | Docker Compose < 2.24 | Upgrade Docker, or hand-edit JVSapp's compose to bind 8080/8443 directly |
| Need to undo everything | — | `rm /opt/jvsapp/docker-compose.override.yml && cd /opt/jvsapp && docker compose up -d`; restore old Caddyfile from `/etc/caddy/Caddyfile.bak.*` |

---

## Security checklist (already applied by the stack)

- [x] MongoDB never exposed to the host
- [x] Photoo backend never exposed to the host (`ports: []` in `docker-compose.prod.yml`)
- [x] Photoo frontend bound to `127.0.0.1:3000` only — host Caddy proxies it
- [x] JVSapp now bound to `127.0.0.1:8080`/`8443` only — host Caddy fronts it
- [x] `JWT_SECRET` is 64-char hex (auto-generated)
- [x] Admin seed endpoint requires `ADMIN_SEED_SECRET` header
- [x] CORS restricted to `https://photoo.in`
- [ ] **TODO on VPS:** `ufw allow 22,80,443/tcp && ufw enable`
