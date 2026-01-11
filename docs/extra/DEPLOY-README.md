# ReList - EC2 Deployment Files

This directory contains everything needed to deploy ReList to AWS EC2.

## 📁 Files Created

### Configuration Files
- **`.env.example`** - Environment variable template with all required and optional settings
- **`docker-compose.prod.yml`** - Production Docker Compose configuration with SSL support
- **`docker/nginx/nginx.production.conf`** - Nginx config for HTTPS with Let's Encrypt
- **`docker/nginx/nginx.development.conf`** - Nginx config for HTTP-only development
- **`docker/nginx/ssl.conf`** - SSL/TLS settings for production

### Deployment Scripts
- **`deploy-ec2.sh`** - Automated deployment script that sets up everything

### Documentation
- **`QUICKSTART-EC2.md`** - Get started in under 10 minutes
- **`DEPLOYMENT.md`** - Complete deployment guide with troubleshooting

## 🚀 Quick Deploy

### Option 1: One-Command Deploy

SSH into your EC2 instance and run:

```bash
curl -fsSL https://raw.githubusercontent.com/alexwebb-biz/relist/main/deploy-ec2.sh -o deploy-ec2.sh
chmod +x deploy-ec2.sh
./deploy-ec2.sh
```

### Option 2: Git Clone + Manual

```bash
# Clone repo
git clone https://github.com/alexwebb-biz/relist.git
cd relist

# Copy and configure environment
cp .env.example .env
nano .env  # Add your credentials

# For development (HTTP only)
docker-compose up -d --build

# For production (HTTPS with SSL)
docker-compose -f docker-compose.prod.yml up -d --build
```

## ⚙️ Environment Setup

### Required Variables (.env)

```env
# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_key

# Authentication
JWT_SECRET=generate_with_openssl_rand_base64_32
JWT_REFRESH_SECRET=another_different_secret

# Production only
DOMAIN=relist.yourdomain.com
NODE_ENV=production
LETSENCRYPT_EMAIL=your-email@example.com
```

### Generate Secrets

```bash
openssl rand -base64 32
```

## 🏗️ Architecture

### Deployment Modes

#### Development (HTTP)
- Uses `docker-compose.yml`
- HTTP only (no SSL)
- Access via `http://YOUR_EC2_IP`
- Good for testing

#### Production (HTTPS)
- Uses `docker-compose.prod.yml`
- Automatic SSL via Let's Encrypt
- Nginx reverse proxy with rate limiting
- Access via `https://your-domain.com`
- Auto-renewal of SSL certificates

### Containers

1. **redis** - Job queue and caching (local)
2. **server** - Node.js backend API
3. **frontend** - React app (Nginx)
4. **nginx** - Reverse proxy (production only)
5. **certbot** - SSL certificate management (production only)

### Data Storage

- **Database**: Supabase Cloud (PostgreSQL)
- **Cache/Queues**: Local Redis container
- **Uploads**: Docker volume `relist-uploads`
- **SSL Certs**: Docker volume `relist-certbot-data`

## 🔒 Security Features

### Production Setup Includes:
- ✅ HTTPS with Let's Encrypt SSL
- ✅ Auto-renewal of certificates
- ✅ Rate limiting (10 req/s for API, 100 req/s general)
- ✅ Security headers (XSS, CSP, etc.)
- ✅ Gzip compression
- ✅ Health checks for all services

### Security Checklist:
- [ ] Update all secrets in `.env`
- [ ] Use strong JWT secrets (32+ chars)
- [ ] Configure Supabase RLS policies
- [ ] Limit SSH access in security group
- [ ] Enable CloudWatch monitoring
- [ ] Set up backup strategy
- [ ] Configure Stripe webhook secrets
- [ ] Never commit `.env` to git

## 📊 Monitoring

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f server
docker-compose logs -f nginx
docker-compose logs -f redis

# Last 100 lines
docker-compose logs --tail=100
```

### Check Status

```bash
# Container status
docker-compose ps

# Resource usage
docker stats

# Health checks
curl http://localhost/api/health
```

## 🔄 Updates

### Update Application

```bash
cd ~/relist
git pull origin main
docker-compose down
docker-compose up -d --build
```

### Update Individual Service

```bash
docker-compose up -d --build server
```

### Rollback

```bash
cd ~/relist
git checkout PREVIOUS_COMMIT_HASH
docker-compose up -d --build
```

## 🆘 Troubleshooting

### Common Issues

**Containers won't start**
```bash
docker-compose ps
docker-compose logs
```

**SSL certificate failed**
```bash
# Check DNS
nslookup your-domain.com

# Check ports
sudo netstat -tulpn | grep -E ':(80|443)'

# Retry certificate
docker-compose exec certbot certbot renew --force-renewal
```

**Out of memory**
```bash
# Check usage
free -h

# Add swap
sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
sudo mkswap /swapfile
sudo swapon /swapfile
```

**Can't connect to database**
```bash
# Test Supabase
curl -H "apikey: YOUR_KEY" https://YOUR_PROJECT.supabase.co/rest/v1/

# Check server logs
docker-compose logs server | grep -i supabase
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed troubleshooting.

## 📦 What Gets Installed

The `deploy-ec2.sh` script installs:
- Docker Engine
- Docker Compose
- Git
- All application containers

## 🎯 AWS Requirements

### EC2 Instance
- **Type**: t3.medium (recommended) or t3.small (minimum)
- **OS**: Amazon Linux 2023 / Amazon Linux 2 / Ubuntu 22.04
- **Storage**: 20GB+ EBS volume
- **Elastic IP**: Recommended for consistent access

### Security Group
- Port 22 (SSH): Your IP only
- Port 80 (HTTP): 0.0.0.0/0 (required for Let's Encrypt)
- Port 443 (HTTPS): 0.0.0.0/0 (for production)

### DNS (for SSL)
- A record pointing to your Elastic IP
- Example: `relist.yourdomain.com` → `52.123.45.67`

## 📚 Documentation

- **Quick Start**: [QUICKSTART-EC2.md](./QUICKSTART-EC2.md)
- **Full Guide**: [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Environment Variables**: [.env.example](./.env.example)
- **Docker Compose**: [docker-compose.prod.yml](./docker-compose.prod.yml)

## 🛠️ Useful Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Restart services
docker-compose restart

# View logs
docker-compose logs -f

# Update app
git pull && docker-compose up -d --build

# Backup Redis
docker exec relist-redis redis-cli SAVE

# Access Redis CLI
docker-compose exec redis redis-cli

# Shell into container
docker-compose exec server sh
```

## 📝 Notes

- **Database**: All data is in Supabase Cloud (has built-in backups)
- **Redis**: Only used for job queues (ephemeral, can be recreated)
- **SSL**: Certificates auto-renew every 60 days
- **Logs**: Rotated automatically by Docker

## 🔗 Links

- **Repository**: https://github.com/alexwebb-biz/relist
- **Supabase Dashboard**: https://app.supabase.com
- **Let's Encrypt**: https://letsencrypt.org
- **Docker Docs**: https://docs.docker.com

## 📞 Support

- Issues: https://github.com/alexwebb-biz/relist/issues
- Email: support@relist.app

---

**Ready to deploy?** Start with [QUICKSTART-EC2.md](./QUICKSTART-EC2.md)!
