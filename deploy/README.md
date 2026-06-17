# CrewBook — Production Deployment Guide

**Domain:** `crew.mmpf.in`  
**VPS:** `45.196.196.114` (root)

---

## Prerequisites

- [ ] VPS SSH access as root
- [ ] Docker installed (confirmed ✅)
- [ ] DNS A record: `crew.mmpf.in` → `45.196.196.114`
- [ ] DNS A record: `app.mmpf.in` → `45.196.196.114` (for HTTPS upgrade)

---

## Architecture

```
Internet (HTTPS)
      │
      ▼
┌─────────────────────────────────────────┐
│  Host Caddy  :80 + :443                 │  /etc/caddy/Caddyfile
│  app.mmpf.in  → localhost:8080          │  ← jvsapp container
│  crew.mmpf.in → localhost:3000          │  ← CrewBook container
└─────────────────────────────────────────┘
           │                    │
           ▼                    ▼
   /opt/jvsapp             /opt/crewbook
   (8080:80)               (3000:80)
   Existing app            ┌──────────────┐
                           │ Frontend:80  │
                           │ /api/* ──────┼──► backend:8001 (Docker-internal)
                           │ /*  ─────────┼──► React SPA
                           └──────────────┘
                           MongoDB: internal only (no host port)
```

**TLS:** Caddy auto-provisions Let's Encrypt certs for both domains. Zero config needed.

---

## One-Command Deploy

SSH into your VPS and run:

```bash
ssh root@45.196.196.114
curl -sSL https://raw.githubusercontent.com/shubhamshirve/CrewApp/main/deploy/deploy.sh | bash
```

The script handles everything in 7 steps (~10 min).

---

## Manual Step-by-Step

If you prefer to run each step yourself:

### Step 1 — Install Caddy on host
```bash
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gnupg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    | tee /etc/apt/sources.list.d/caddy-stable.list
apt-get update && apt-get install -y caddy
systemctl enable caddy
```

### Step 2 — Migrate jvsapp from port 80 → 8080
```bash
cd /opt/jvsapp

# Back up
cp docker-compose.yml docker-compose.yml.bak

# Patch port
sed -i 's/"80:80"/"127.0.0.1:8080:80"/g' docker-compose.yml
sed -i 's/- 80:80/- 127.0.0.1:8080:80/g' docker-compose.yml

# Restart
docker compose down && docker compose up -d
```

### Step 3 — Deploy CrewBook
```bash
git clone https://github.com/shubhamshirve/CrewApp.git /opt/crewbook
cd /opt/crewbook

# Create backend/.env
cp deploy/env.production.example backend/.env
# Edit it: nano backend/.env
# At minimum, set JWT_SECRET and CORS_ORIGINS=https://crew.mmpf.in

# Build and start
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

### Step 4 — Install Caddyfile
```bash
cp /opt/crewbook/deploy/caddy-vps.conf /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile
systemctl restart caddy
```

### Step 5 — Seed demo data (optional)
```bash
cd /opt/crewbook
docker compose exec backend python /app/scripts/seed_data.py
```

---

## Post-Deploy Commands

```bash
cd /opt/crewbook

# Check all containers
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps

# Follow logs
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f

# Restart backend after .env changes
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart backend

# Update to latest code
git pull && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Check Caddy logs
journalctl -u caddy -f

# Reload Caddy after config change
systemctl reload caddy
```

---

## Makefile shortcuts (from /opt/crewbook)

```bash
make up          # start services
make down        # stop services
make logs        # follow logs
make seed        # insert demo data
make reset-seed  # wipe + re-seed
make health      # check API health
```

> Note: The Makefile `up` / `down` / `logs` targets use the base docker-compose.yml.
> For production (with prod overrides), use the full command above.

---

## Updating an Existing Deployment

```bash
ssh root@45.196.196.114
cd /opt/crewbook
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

---

## Troubleshooting

| Symptom | Check |
|---------|-------|
| HTTPS cert not issued | DNS propagated? `dig crew.mmpf.in` should return `45.196.196.114` |
| 502 Bad Gateway | Container running? `docker ps` — check frontend is up |
| App loads but API fails | Check CORS_ORIGINS in `backend/.env` matches `https://crew.mmpf.in` |
| Caddy won't start | `caddy validate --config /etc/caddy/Caddyfile` |
| Port 80 already in use | `ss -tlnp | grep :80` — stop conflicting service |
| jvsapp broken after migration | Restore: `cp docker-compose.yml.bak docker-compose.yml && docker compose up -d` |

---

## Security Checklist

- [x] MongoDB not exposed to host (no ports mapping)
- [x] Backend not exposed to host (ports: [] in prod override)
- [x] Frontend bound to 127.0.0.1 only (host Caddy proxies it)
- [x] CORS restricted to `https://crew.mmpf.in`
- [x] JWT secret is 64-char hex (auto-generated)
- [x] Admin seed endpoint requires `ADMIN_SEED_SECRET` header
- [ ] Add firewall rules: `ufw allow 22,80,443/tcp && ufw enable`
