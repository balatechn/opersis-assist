# Opersis Assist — Remote Monitoring & Management Platform

A modern, self-hosted RMM platform built from scratch. Monitor devices, execute remote commands, and manage infrastructure through a clean web dashboard.

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                  Opersis Assist                       │
│                                                       │
│  ┌─────────┐     ┌──────────────┐    ┌──────────┐   │
│  │  Web UI  │────▶│  Backend API  │◀──▶│ MongoDB  │   │
│  │ (Next.js)│     │  (Express)   │    └──────────┘   │
│  └─────────┘     │  + WebSocket  │    ┌──────────┐   │
│                   │              │◀──▶│  Redis    │   │
│                   └──────┬───────┘    └──────────┘   │
│                          │ WSS                        │
│                  ┌───────▼───────┐                    │
│                  │   Agents      │                    │
│                  │ (Win/Lin/Mac) │                    │
│                  └───────────────┘                    │
└──────────────────────────────────────────────────────┘
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend | Node.js, Express, WebSocket |
| Frontend | Next.js 14, React, Tailwind CSS |
| State | Zustand |
| Database | MongoDB 7 |
| Cache | Redis 7 |
| Agent | Node.js (Windows service) |
| Auth | JWT + RBAC |

## Project Structure

```
opersis-assist/
├── server/          # Backend API + WebSocket server
│   └── src/
│       ├── config/       # DB, Redis, env config
│       ├── middleware/    # Auth, error handling
│       ├── models/       # Mongoose schemas
│       ├── routes/       # REST API endpoints
│       └── services/     # WebSocket, logging
├── agent/           # Device monitoring agent
│   └── src/
│       ├── collectors/   # System metrics collection
│       └── services/     # Remote shell service
├── web/             # Next.js frontend dashboard
│   └── src/
│       ├── app/          # App router pages
│       ├── components/   # Shared components
│       ├── lib/          # API client, WS client
│       └── store/        # Zustand stores
└── docker/          # Docker Compose + Dockerfiles
```

## Quick Start (Development)

### Prerequisites
- Node.js 20+
- MongoDB 7+ running locally
- Redis 7+ running locally

### 1. Backend

```bash
cd server
cp .env.example .env    # Edit settings
npm install
npm run dev             # Starts on :4000
```

### 2. Frontend

```bash
cd web
npm install
npm run dev             # Starts on :3000
```

### 3. Agent (Windows)

```bash
cd agent
cp .env.example .env    # Set SERVER_URL and AGENT_SECRET
npm install
npm start               # Connects to backend
```

## Docker Deployment

```bash
cd docker
cp .env.example .env    # Configure all secrets and URLs
docker compose up -d
```

This starts 4 services:
- **Backend** → `localhost:4000`
- **Frontend** → `localhost:3000`
- **MongoDB** → internal
- **Redis** → internal

## Coolify VPS Deployment

### Step 1: Push to Git
Push this repository to GitHub/GitLab.

### Step 2: Create Coolify Resource
1. In Coolify → **New Resource** → **Docker Compose**
2. Point to your repository
3. Set build path to `docker/`
4. Set Docker Compose file to `docker/docker-compose.yml`

### Step 3: Configure Environment Variables
In Coolify, set these environment variables:

| Variable | Value |
|----------|-------|
| `MONGO_PASSWORD` | Strong random password |
| `JWT_SECRET` | `openssl rand -hex 32` |
| `AGENT_SECRET` | `openssl rand -hex 32` |
| `NEXT_PUBLIC_API_URL` | `https://api.yourdomain.com` |
| `NEXT_PUBLIC_WS_URL` | `wss://api.yourdomain.com` |
| `CORS_ORIGIN` | `https://yourdomain.com` |

### Step 4: Configure Domains
- Assign `yourdomain.com` → frontend service (port 3000)
- Assign `api.yourdomain.com` → backend service (port 4000)
- Enable **HTTPS / Auto SSL** for both

### Step 5: Deploy
Click **Deploy** — Coolify handles building, SSL, and networking.

### Step 6: First Login
1. Open `https://yourdomain.com`
2. Register your admin account (first user = admin)
3. Configure your agents with the backend URL

## Agent Installation on Windows

```powershell
# On the target Windows machine
git clone <repo-url>
cd opersis-assist/agent

# Configure
copy .env.example .env
# Edit .env: set SERVER_URL=wss://api.yourdomain.com/ws/agent
# Edit .env: set AGENT_SECRET=<same as server>

npm install

# Option A: Run directly
npm start

# Option B: Install as Windows service
npm run install-service
```

## Features

### Phase 1 (MVP) ✅
- [x] Device registration via agent
- [x] Dashboard with live CPU/RAM/Disk stats
- [x] Online/offline tracking
- [x] Remote terminal (WebSocket shell)
- [x] JWT authentication + RBAC
- [x] Alert system (CPU, RAM, disk thresholds)
- [x] Dark/light mode

### Phase 2 (Planned)
- [ ] Remote desktop (WebRTC)
- [ ] File manager (upload/download)
- [ ] Custom alert rules

### Phase 3 (Planned)
- [ ] Multi-tenant support
- [ ] Audit logs UI
- [ ] Fine-grained permissions

### Phase 4 (Planned)
- [ ] AI-powered issue detection
- [ ] Auto-fix scripts
- [ ] Patch management

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Current user |
| GET | `/api/devices` | List devices |
| GET | `/api/devices/stats` | Device summary |
| GET | `/api/devices/:id` | Single device |
| PATCH | `/api/devices/:id` | Update device |
| DELETE | `/api/devices/:id` | Remove device |
| GET | `/api/alerts` | List alerts |
| PATCH | `/api/alerts/:id/acknowledge` | Acknowledge alert |

## WebSocket Endpoints

| Path | Purpose |
|------|---------|
| `/ws/agent` | Agent → Server communication |
| `/ws/dashboard?token=JWT` | Dashboard real-time updates |

## Security

- All agent communication via WSS in production
- JWT token authentication with expiry
- RBAC (admin, operator, viewer)
- Rate limiting on auth endpoints
- Helmet.js security headers
- Input validation on all endpoints
- Alert deduplication (5-min window)

## License

MIT
