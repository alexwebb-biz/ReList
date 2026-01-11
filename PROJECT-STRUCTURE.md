# ReList - Project Structure

Clean, organized project structure for easy navigation.

## 📁 Directory Layout

```
relist/
├── 📄 README.md                    # Main project documentation
├── 📄 .env.example                 # Environment variable template
├── 📄 docker-compose.yml           # Local development setup
├── 📄 docker-compose.prod.yml      # Production deployment setup
│
├── 📂 components/                  # React components
│   ├── AlertResults.tsx
│   ├── InventoryManager.tsx
│   ├── Navigation.tsx
│   ├── Research.tsx
│   └── ...
│
├── 📂 server/                      # Backend application
│   ├── 📂 src/
│   │   ├── 📂 config/             # Configuration files
│   │   │   ├── database.ts
│   │   │   ├── pg.ts
│   │   │   ├── redis.ts
│   │   │   └── supabase.ts
│   │   ├── 📂 middleware/         # Express middleware
│   │   ├── 📂 routes/             # API endpoints
│   │   │   ├── alerts.ts
│   │   │   ├── auth.ts
│   │   │   ├── ebay.ts
│   │   │   ├── inventory.ts
│   │   │   ├── listings.ts
│   │   │   ├── research.ts
│   │   │   ├── results.ts
│   │   │   ├── telegram.ts
│   │   │   └── watchlist.ts
│   │   ├── 📂 services/           # Business logic
│   │   │   ├── authService.ts
│   │   │   ├── aiService.ts
│   │   │   ├── feeCalculatorService.ts
│   │   │   ├── flipFinderService.ts
│   │   │   ├── inventoryService.ts
│   │   │   ├── listingOptimizerService.ts
│   │   │   ├── marketResearchService.ts
│   │   │   ├── notificationService.ts
│   │   │   ├── resultsService.ts
│   │   │   ├── scraperService.ts
│   │   │   └── watchlistService.ts
│   │   ├── 📂 queues/             # Background jobs
│   │   │   └── alertQueue.ts
│   │   ├── 📂 migrations/         # Database migrations
│   │   └── index.ts               # Entry point
│   └── package.json
│
├── 📂 docker/                      # Docker configuration
│   ├── 📂 nginx/                  # Nginx configs
│   │   ├── nginx.production.conf  # HTTPS config
│   │   ├── nginx.development.conf # HTTP config
│   │   └── ssl.conf               # SSL/TLS settings
│   ├── Dockerfile.frontend        # Frontend container
│   └── Dockerfile.server          # Backend container
│
├── 📂 docs/                        # 📚 Essential documentation
│   ├── README.md                   # Documentation index
│   ├── QUICKSTART-EC2.md          # 10-minute quick start
│   ├── DEPLOYMENT.md              # Full deployment guide
│   ├── deploy-ec2.sh              # Automated deployment script
│   │
│   └── 📂 extra/                  # Additional reference docs
│       ├── technical_architecture.md
│       ├── implementation_checklist.md
│       ├── scraper_docs.md
│       ├── DOCKER.md
│       ├── DEPLOY-README.md
│       └── ...schema export tools
│
└── 📂 .github/                     # GitHub workflows (if any)
```

## 📝 Key Files

### Root Level

| File | Purpose |
|------|---------|
| `README.md` | Main project documentation |
| `.env.example` | Environment variable template (safe to commit) |
| `.env` | Your actual environment variables (DO NOT COMMIT) |
| `.env.local` | Local development environment (DO NOT COMMIT) |
| `docker-compose.yml` | Local/development Docker setup |
| `docker-compose.prod.yml` | Production Docker setup with SSL |
| `package.json` | Frontend dependencies |
| `tsconfig.json` | TypeScript configuration |

### Documentation (`/docs`)

| File | Purpose |
|------|---------|
| `README.md` | Documentation index |
| `QUICKSTART-EC2.md` | Fast deployment guide (10 min) |
| `DEPLOYMENT.md` | Complete deployment guide |
| `deploy-ec2.sh` | Automated deployment script |

### Server (`/server/src`)

| Directory | Purpose |
|-----------|---------|
| `config/` | Database, Redis, Supabase configuration |
| `routes/` | API endpoint definitions |
| `services/` | Business logic and integrations |
| `queues/` | Background job processing |
| `middleware/` | Express middleware (auth, etc.) |
| `migrations/` | Database schema changes |

### Docker (`/docker`)

| File | Purpose |
|------|---------|
| `Dockerfile.frontend` | Frontend container definition |
| `Dockerfile.server` | Backend container definition |
| `nginx/nginx.production.conf` | HTTPS reverse proxy config |
| `nginx/nginx.development.conf` | HTTP reverse proxy config |
| `nginx/ssl.conf` | SSL/TLS settings |

## 🚫 Files Removed

The following files were removed as part of the cleanup:

- ✅ `docker-compose.dev.yml` - Consolidated into `docker-compose.yml`
- ✅ `.env.docker` - Redundant, using `.env` instead
- ✅ Root-level documentation clutter - Moved to `/docs` or `/docs/extra`

## 🗂️ Organization Strategy

### Essential Documentation (`/docs`)
Files you need for deployment and running the app:
- Quick start guides
- Deployment instructions
- Automated scripts

### Reference Documentation (`/docs/extra`)
Additional materials for reference:
- Technical architecture
- Implementation details
- Schema export utilities
- Historical documentation

## 🔍 Finding What You Need

### "I want to deploy to production"
→ Start with [`/docs/QUICKSTART-EC2.md`](./docs/QUICKSTART-EC2.md)

### "I need detailed deployment help"
→ See [`/docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md)

### "I want to understand the architecture"
→ Read [`/docs/extra/technical_architecture.md`](./docs/extra/technical_architecture.md)

### "I need to configure environment variables"
→ Copy [`.env.example`](./.env.example) to `.env` and edit

### "I want to add a new API endpoint"
→ Create new file in [`/server/src/routes/`](./server/src/routes/)

### "I need to add business logic"
→ Create service in [`/server/src/services/`](./server/src/services/)

### "I want to modify the scraper"
→ Edit [`/server/src/services/scraperService.ts`](./server/src/services/scraperService.ts)
→ Docs: [`/docs/extra/scraper_docs.md`](./docs/extra/scraper_docs.md)

## 📦 Environment Files

| File | Purpose | Commit? |
|------|---------|---------|
| `.env.example` | Template with placeholders | ✅ Yes |
| `.env` | Production secrets (Docker) | ❌ No |
| `.env.local` | Local dev secrets | ❌ No |
| `.env.production` | Production overrides | ❌ No |

**Gitignore ensures secrets are never committed.**

## 🚀 Quick Commands

```bash
# Development
npm run dev                          # Start dev server

# Docker (local)
docker-compose up -d --build         # Start all services
docker-compose logs -f               # View logs
docker-compose down                  # Stop all services

# Docker (production)
docker-compose -f docker-compose.prod.yml up -d --build

# Deployment
cd docs && ./deploy-ec2.sh          # Automated EC2 setup
```

## 🎯 Best Practices

1. **Environment Variables**
   - Always copy from `.env.example`
   - Never commit `.env` or `.env.local`
   - Use `.env` for Docker, `.env.local` for local dev

2. **Documentation**
   - Essential docs in `/docs`
   - Reference materials in `/docs/extra`
   - Keep README.md up to date

3. **Code Organization**
   - Routes in `/server/src/routes/`
   - Business logic in `/server/src/services/`
   - Configuration in `/server/src/config/`
   - Components in `/components/`

4. **Docker**
   - Use `docker-compose.yml` for local dev
   - Use `docker-compose.prod.yml` for production
   - Keep Dockerfiles in `/docker/`

## 📚 Related Documentation

- [Main README](./README.md)
- [Quick Start Guide](./docs/QUICKSTART-EC2.md)
- [Deployment Guide](./docs/DEPLOYMENT.md)
- [Documentation Index](./docs/README.md)

---

**Clean structure = Happy developers** ✨
