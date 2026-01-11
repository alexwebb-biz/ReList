# Relist - Docker Desktop Deployment

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Docker Desktop                          │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  PostgreSQL │  │    Redis    │  │       Server        │ │
│  │   :5432     │  │    :6379    │  │  (Node.js) :3000    │ │
│  │             │  │             │  │                     │ │
│  │  Database   │  │  Cache &    │  │  Backend API        │ │
│  │  Storage    │  │  Job Queue  │  │                     │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│         │                │                   │              │
│         └────────────────┴───────────────────┘              │
│                          │                                  │
│                   relist-network                            │
│                          │                                  │
│                ┌─────────────────┐                         │
│                │    Frontend     │                         │
│                │  (Nginx) :80    │                         │
│                │                 │                         │
│                │  React App      │                         │
│                └─────────────────┘                         │
│                          │                                  │
└──────────────────────────┼──────────────────────────────────┘
                           │
                    http://localhost
```

---

## Step-by-Step Setup

### Prerequisites

1. **Install Docker Desktop**
   - Download from: https://www.docker.com/products/docker-desktop/
   - Install and start Docker Desktop
   - Make sure it's running (whale icon in system tray)

---

### Step 1: Create Environment File

1. In the project folder, find `.env.docker`
2. Copy it and rename to `.env`:

**Windows (Command Prompt):**
```cmd
copy .env.docker .env
```

**Windows (PowerShell):**
```powershell
Copy-Item .env.docker .env
```

**Mac/Linux:**
```bash
cp .env.docker .env
```

---

### Step 2: Configure Environment (Optional)

Open `.env` and change the JWT secrets to random strings:

```env
JWT_SECRET=my-super-secret-random-string-here-1234567890
JWT_REFRESH_SECRET=another-random-string-for-refresh-tokens
```

> **Tip:** You can generate random strings at https://randomkeygen.com/

---

### Step 3: Build and Start Containers

Open a terminal in the project folder and run:

```bash
docker compose up -d --build
```

This will:
- Download PostgreSQL and Redis images
- Build the server and frontend images
- Create all 4 containers
- Start everything

**First time will take 5-10 minutes** (downloading/building).

---

### Step 4: Check Status

```bash
docker compose ps
```

You should see 4 containers running:
```
NAME               STATUS
relist-postgres    running (healthy)
relist-redis       running (healthy)
relist-server      running
relist-frontend    running
```

---

### Step 5: Open the App

Open your browser and go to:

**http://localhost**

That's it! The app is running.

---

## Useful Commands

| Command | Description |
|---------|-------------|
| `docker compose up -d --build` | Build and start all containers |
| `docker compose down` | Stop all containers |
| `docker compose ps` | See container status |
| `docker compose logs -f` | View all logs (live) |
| `docker compose logs -f server` | View server logs only |
| `docker compose restart server` | Restart just the server |
| `docker compose down -v` | Stop and delete all data |

---

## Troubleshooting

### "Port already in use"

Something else is using port 80, 5432, 6379, or 3000.

**Option 1:** Stop the other service

**Option 2:** Change ports in `.env`:
```env
# Add these to your .env file to use different ports
POSTGRES_PORT=5433
REDIS_PORT=6380
SERVER_PORT=3001
FRONTEND_PORT=8080
```

Then access the app at `http://localhost:8080` instead.

---

### "Container keeps restarting"

Check the logs:
```bash
docker compose logs server
```

Common issues:
- Missing environment variables
- Database not ready yet (wait 30 seconds and try again)

---

### "Can't connect to database"

The database container might still be starting. Wait 30 seconds, then:
```bash
docker compose restart server
```

---

### Reset Everything

To completely reset (deletes all data):
```bash
docker compose down -v
docker compose up -d --build
```

---

## Container Details

| Container | Port | Purpose |
|-----------|------|---------|
| relist-postgres | 5432 | PostgreSQL database |
| relist-redis | 6379 | Redis cache & job queue |
| relist-server | 3000 | Backend API |
| relist-frontend | 80 | Frontend (Nginx) |

---

## Data Persistence

Your data is stored in Docker volumes:
- `relist-postgres-data` - Database
- `relist-redis-data` - Redis cache
- `relist-uploads` - Uploaded files

Data persists even when containers stop. Only `docker compose down -v` deletes data.

---

## Accessing Services Directly

**Database (PostgreSQL):**
```bash
docker exec -it relist-postgres psql -U relist -d relist
```

**Redis:**
```bash
docker exec -it relist-redis redis-cli
```

**Server Shell:**
```bash
docker exec -it relist-server sh
```

---

## Updating the App

When you have code changes:

```bash
docker compose down
docker compose up -d --build
```

---

## Cost Savings

| Service | Cloud Cost | Docker (Free) |
|---------|------------|---------------|
| PostgreSQL | Supabase $25+/mo | ✓ |
| Redis | Upstash $10-50/mo | ✓ |
| **Total** | **$35-75/month** | **$0** |
