# ReList

AI-powered reselling platform for eBay, Vinted, Depop, and more. Track inventory, find profitable flips, optimize listings, and automate notifications.

## 🚀 Features

- **Marketplace Integration** - eBay, Vinted, Depop, Gumtree scraping
- **Alert System** - Get notified of profitable deals via Telegram
- **Inventory Management** - Track your items and sales
- **AI Listing Optimizer** - Generate optimized product descriptions
- **Price Tracking** - Historical price data and trends
- **Flip Finder** - Discover underpriced items to resell

## 📋 Prerequisites

- **Node.js** 18+ (for local development)
- **Docker** & Docker Compose (for deployment)
- **Supabase Account** - Database (cloud)
- **Optional**: Stripe, Telegram, eBay API credentials

## 🏃 Quick Start

### Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your credentials
   ```

3. **Run the app**:
   ```bash
   npm run dev
   ```

   Access at: http://localhost:5173

### Docker (Local)

1. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

2. **Start containers**:
   ```bash
   docker-compose up -d --build
   ```

   Access at: http://localhost

## ☁️ Deploy to AWS EC2

Deploy to production in under 10 minutes with our automated script.

### Quick Deploy

```bash
# SSH into your EC2 instance
ssh -i your-key.pem ec2-user@YOUR_EC2_IP

# Run automated deployment
curl -fsSL https://raw.githubusercontent.com/alexwebb-biz/relist/main/docs/deploy-ec2.sh -o deploy-ec2.sh
chmod +x deploy-ec2.sh
./deploy-ec2.sh
```

### Documentation

- **[Quick Start Guide](./docs/QUICKSTART-EC2.md)** - Deploy in 10 minutes
- **[Full Deployment Guide](./docs/DEPLOYMENT.md)** - Detailed instructions with troubleshooting
- **[Additional Docs](./docs/)** - Architecture, API docs, and more

## 🗂️ Project Structure

```
relist/
├── components/          # React components
├── server/             # Backend API
│   ├── src/
│   │   ├── routes/    # API endpoints
│   │   ├── services/  # Business logic
│   │   ├── config/    # Configuration
│   │   └── queues/    # Background jobs
├── docker/             # Docker configuration
│   ├── nginx/         # Nginx configs
│   └── Dockerfile.*   # Container definitions
├── docs/              # Documentation
│   ├── QUICKSTART-EC2.md
│   ├── DEPLOYMENT.md
│   └── extra/         # Additional docs
├── .env.example       # Environment template
├── docker-compose.yml # Development compose
└── docker-compose.prod.yml # Production compose
```

## 🔧 Configuration

### Required Environment Variables

```env
# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_key

# Authentication
JWT_SECRET=your_jwt_secret_min_32_chars
JWT_REFRESH_SECRET=your_refresh_secret_min_32_chars
```

### Optional Integrations

```env
# Payments
STRIPE_SECRET_KEY=sk_live_...

# Notifications
TELEGRAM_BOT_TOKEN=...

# eBay API
EBAY_CLIENT_ID=...
EBAY_CLIENT_SECRET=...

# AI Features
GROQ_API_KEY=...
```

See [.env.example](./.env.example) for all options.

## 🏗️ Architecture

- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express
- **Database**: Supabase (PostgreSQL)
- **Cache/Queue**: Redis (local)
- **Reverse Proxy**: Nginx (production)
- **SSL**: Let's Encrypt (automatic)

### Production Stack

```
Internet → Nginx (443) → Frontend (80)
                      → Backend (3000) → Supabase Cloud
                                      → Redis (6379)
```

## 📊 Key Features Explained

### Alert System
Set up custom alerts to monitor marketplaces for profitable items:
- Price range filters
- Keyword matching
- Exclude terms
- Telegram notifications with inline buttons

### Inventory Management
Track your items from purchase to sale:
- Purchase price, fees, shipping
- Current status (listed, sold, etc.)
- Profit calculations
- Aging reports

### AI Listing Optimizer
Generate optimized product descriptions:
- SEO-friendly titles
- Detailed descriptions
- Keyword suggestions

## 🛠️ Development

### Server

```bash
cd server
npm install
npm run dev
```

Runs on: http://localhost:3000

### Frontend

```bash
npm install
npm run dev
```

Runs on: http://localhost:5173

### Database Migrations

Migrations are managed via Supabase Dashboard or CLI.

## 📦 Deployment Options

| Method | Best For | Setup Time |
|--------|----------|------------|
| **Docker Compose** | Local testing | 5 minutes |
| **EC2 (automated)** | Production | 10 minutes |
| **EC2 (manual)** | Custom setup | 30 minutes |

## 🔒 Security

- HTTPS with automatic SSL renewal
- Rate limiting (10 req/s API, 100 req/s general)
- Security headers (XSS, CSP, etc.)
- JWT authentication
- Supabase RLS policies
- Environment variable isolation

## 📝 Useful Commands

```bash
# View logs
docker-compose logs -f

# Restart services
docker-compose restart

# Stop all
docker-compose down

# Update app
git pull && docker-compose up -d --build

# Access Redis CLI
docker-compose exec redis redis-cli

# Shell into server
docker-compose exec server sh
```

## 🐛 Troubleshooting

See the [Deployment Guide](./docs/DEPLOYMENT.md#troubleshooting) for common issues and solutions.

Quick checks:
```bash
# Check container status
docker-compose ps

# View specific logs
docker-compose logs server

# Test Supabase connection
curl -H "apikey: YOUR_KEY" https://YOUR_PROJECT.supabase.co/rest/v1/
```

## 📚 Documentation

- **[Quick Start](./docs/QUICKSTART-EC2.md)** - Fast deployment
- **[Full Deployment Guide](./docs/DEPLOYMENT.md)** - Detailed setup
- **[Documentation Index](./docs/)** - All docs
- **[Technical Architecture](./docs/extra/technical_architecture.md)** - System design
- **[API Documentation](./docs/extra/scraper_docs.md)** - Scraper details

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License

## 💬 Support

- **Issues**: https://github.com/alexwebb-biz/relist/issues
- **Email**: support@relist.app
- **Documentation**: [./docs/](./docs/)

## 🎯 Roadmap

- [ ] Additional marketplace integrations
- [ ] Mobile app
- [ ] Advanced analytics dashboard
- [ ] Automated repricing
- [ ] Bulk listing tools

---

Built with ❤️ for resellers
