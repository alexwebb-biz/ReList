# ReList - AWS EC2 Deployment Guide

Complete guide for deploying ReList on AWS EC2 with Docker and optional SSL/HTTPS.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Detailed Setup](#detailed-setup)
4. [Environment Configuration](#environment-configuration)
5. [SSL/HTTPS Setup](#sslhttps-setup)
6. [Maintenance](#maintenance)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### AWS Setup

1. **EC2 Instance**
   - **Recommended**: `t3.medium` or larger (2 vCPU, 4GB RAM)
   - **Minimum**: `t3.small` (2 vCPU, 2GB RAM)
   - **OS**: Amazon Linux 2023, Amazon Linux 2, or Ubuntu 22.04
   - **Storage**: 20GB+ EBS volume

2. **Security Group Configuration**
   - **Port 22** (SSH): Your IP address
   - **Port 80** (HTTP): 0.0.0.0/0 (required for Let's Encrypt)
   - **Port 443** (HTTPS): 0.0.0.0/0 (for production)

3. **Elastic IP** (Recommended)
   - Allocate and associate an Elastic IP for consistent access

4. **Domain Name** (Optional, for SSL)
   - Point an A record to your EC2 Elastic IP
   - Example: `relist.yourdomain.com` → `YOUR_ELASTIC_IP`

### Required Credentials

Before deployment, gather these credentials:

- **Supabase** (Required)
  - Project URL
  - Anon Key
  - Service Role Key
  - Get from: https://app.supabase.com/project/YOUR_PROJECT/settings/api

- **JWT Secrets** (Required)
  - Generate with: `openssl rand -base64 32`
  - Need two different secrets (main + refresh)

- **Optional Services**
  - Stripe API keys (for payments)
  - Telegram Bot Token (for notifications)
  - eBay API credentials (for marketplace integration)
  - SMTP credentials (for email)
  - Groq/HuggingFace API keys (for AI features)

---

## Quick Start

### Method 1: Automated Script (Recommended)

SSH into your EC2 instance and run:

```bash
# Download and run deployment script
curl -fsSL https://raw.githubusercontent.com/alexwebb-biz/relist/main/deploy-ec2.sh -o deploy-ec2.sh
chmod +x deploy-ec2.sh
./deploy-ec2.sh
```

The script will:
1. Install Docker and Docker Compose
2. Clone the repository
3. Guide you through environment configuration
4. Build and start all containers
5. Set up SSL certificates (if in production mode)

### Method 2: Manual Setup

See [Detailed Setup](#detailed-setup) below.

---

## Detailed Setup

### Step 1: Connect to EC2

```bash
# Replace with your key file and EC2 public IP
ssh -i your-key.pem ec2-user@YOUR_EC2_IP

# Or for Ubuntu
ssh -i your-key.pem ubuntu@YOUR_EC2_IP
```

### Step 2: Update System and Install Dependencies

#### For Amazon Linux 2023/2

```bash
# Update system
sudo yum update -y

# Install Docker
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -a -G docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Git
sudo yum install -y git

# Logout and login again to apply Docker group permissions
exit
```

#### For Ubuntu 22.04

```bash
# Update system
sudo apt-get update
sudo apt-get upgrade -y

# Install Docker
sudo apt-get install -y apt-transport-https ca-certificates curl software-properties-common
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu focal stable"
sudo apt-get update
sudo apt-get install -y docker-ce
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -a -G docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Logout and login again to apply Docker group permissions
exit
```

### Step 3: Clone Repository

```bash
# SSH back in
ssh -i your-key.pem ec2-user@YOUR_EC2_IP

# Clone the repo
git clone https://github.com/alexwebb-biz/relist.git
cd relist
```

### Step 4: Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit with your values
nano .env
```

See [Environment Configuration](#environment-configuration) for required values.

### Step 5: Choose Deployment Mode

#### Development (HTTP only)

```bash
# Use default docker-compose.yml
docker-compose up -d --build
```

Access at: `http://YOUR_EC2_IP`

#### Production (HTTPS with SSL)

1. **Update .env**:
   ```env
   DOMAIN=relist.yourdomain.com
   NODE_ENV=production
   LETSENCRYPT_EMAIL=your-email@example.com
   ```

2. **Update SSL config**:
   ```bash
   # Replace DOMAIN_PLACEHOLDER with your actual domain
   sed -i "s/DOMAIN_PLACEHOLDER/relist.yourdomain.com/g" docker/nginx/ssl.conf
   ```

3. **Start containers**:
   ```bash
   docker-compose -f docker-compose.prod.yml up -d --build
   ```

4. **Obtain SSL certificate**:
   ```bash
   # Wait for containers to start
   sleep 15

   # Get certificate
   sudo docker run --rm \
     -v relist-certbot-data:/etc/letsencrypt \
     -v relist-certbot-www:/var/www/certbot \
     certbot/certbot certonly \
     --webroot \
     --webroot-path=/var/www/certbot \
     --email your-email@example.com \
     --agree-tos \
     --no-eff-email \
     -d relist.yourdomain.com

   # Restart nginx to apply certificate
   docker-compose -f docker-compose.prod.yml restart nginx
   ```

Access at: `https://relist.yourdomain.com`

---

## Environment Configuration

### Required Variables

Edit `.env` and set these values:

```env
# Database (Required)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_KEY=your_service_role_key_here

# Authentication (Required)
JWT_SECRET=generate_with_openssl_rand_base64_32
JWT_REFRESH_SECRET=another_different_secret_here

# Production Settings (Required for SSL)
DOMAIN=relist.yourdomain.com
NODE_ENV=production
LETSENCRYPT_EMAIL=your-email@example.com
```

### Optional Variables

```env
# Stripe Payments
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STARTER_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_BUSINESS_PRICE_ID=price_...

# Telegram Notifications
TELEGRAM_BOT_TOKEN=1234567890:ABC...

# eBay Integration
EBAY_CLIENT_ID=...
EBAY_CLIENT_SECRET=...
EBAY_REDIRECT_URI=https://relist.yourdomain.com/api/ebay/callback

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# AI Features
GROQ_API_KEY=...
HUGGINGFACE_API_KEY=...
```

### Generate Secrets

```bash
# Generate JWT secrets
openssl rand -base64 32
openssl rand -base64 32
```

---

## SSL/HTTPS Setup

### Automatic (via deployment script)

The deployment script handles SSL setup automatically when `NODE_ENV=production`.

### Manual Setup

1. **Ensure DNS is configured**:
   ```bash
   # Check DNS resolution
   nslookup relist.yourdomain.com
   # Should return your EC2 IP
   ```

2. **Update configuration**:
   ```bash
   # Update .env
   DOMAIN=relist.yourdomain.com
   NODE_ENV=production
   LETSENCRYPT_EMAIL=your-email@example.com

   # Update nginx SSL config
   sed -i "s/DOMAIN_PLACEHOLDER/relist.yourdomain.com/g" docker/nginx/ssl.conf
   ```

3. **Start services**:
   ```bash
   docker-compose -f docker-compose.prod.yml up -d --build
   ```

4. **Obtain certificate**:
   ```bash
   sudo docker run --rm \
     -v relist-certbot-data:/etc/letsencrypt \
     -v relist-certbot-www:/var/www/certbot \
     certbot/certbot certonly \
     --webroot \
     --webroot-path=/var/www/certbot \
     --email your-email@example.com \
     --agree-tos \
     -d relist.yourdomain.com
   ```

5. **Restart nginx**:
   ```bash
   docker-compose -f docker-compose.prod.yml restart nginx
   ```

### SSL Certificate Renewal

Certificates auto-renew via the `certbot` container (checks daily).

Manual renewal:
```bash
docker-compose -f docker-compose.prod.yml exec certbot certbot renew
docker-compose -f docker-compose.prod.yml restart nginx
```

---

## Maintenance

### View Logs

```bash
# All containers
docker-compose logs -f

# Specific container
docker-compose logs -f server
docker-compose logs -f nginx
docker-compose logs -f redis
```

### Restart Services

```bash
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart server
```

### Update Application

```bash
cd ~/relist

# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose up -d --build

# Or for production
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d --build
```

### Stop Application

```bash
# Stop all containers
docker-compose down

# Stop and remove volumes (DANGER: deletes data)
docker-compose down -v
```

### Database Backup (Supabase)

Your data is on Supabase Cloud, which has automatic backups.

To export:
```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref YOUR_PROJECT_REF

# Export data
supabase db dump -f backup.sql
```

### Redis Backup

```bash
# Redis data is in Docker volume
docker run --rm \
  -v relist-redis-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/redis-backup.tar.gz /data
```

---

## Troubleshooting

### Containers Not Starting

```bash
# Check container status
docker-compose ps

# View logs for errors
docker-compose logs

# Check specific container
docker-compose logs server
```

### SSL Certificate Issues

**Error: "Unable to obtain certificate"**

1. **Check DNS**:
   ```bash
   nslookup your-domain.com
   # Should return your EC2 IP
   ```

2. **Check ports**:
   ```bash
   sudo netstat -tulpn | grep -E ':(80|443)'
   # Should show nginx listening
   ```

3. **Check rate limits**:
   - Let's Encrypt: 5 failures per hour, 50 certificates per week
   - Wait and try again or use staging: `--test-cert`

**Error: "Connection refused"**

- Check security group allows ports 80 and 443
- Check nginx is running: `docker-compose ps nginx`

### Database Connection Issues

```bash
# Test Supabase connection
curl -H "apikey: YOUR_ANON_KEY" \
     https://YOUR_PROJECT.supabase.co/rest/v1/

# Should return API info
```

Check `.env` has correct:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`

### Out of Memory

```bash
# Check memory usage
free -h

# Resize EC2 instance or add swap:
sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### Port Already in Use

```bash
# Check what's using port 80/443
sudo lsof -i :80
sudo lsof -i :443

# Stop conflicting service
sudo systemctl stop httpd
sudo systemctl stop apache2
```

### Permission Denied (Docker)

```bash
# Add user to docker group
sudo usermod -a -G docker $USER

# Logout and login again
exit
ssh -i your-key.pem ec2-user@YOUR_EC2_IP
```

### Application Errors

1. **Check server logs**:
   ```bash
   docker-compose logs server
   ```

2. **Check Redis connection**:
   ```bash
   docker-compose exec redis redis-cli ping
   # Should return "PONG"
   ```

3. **Restart services**:
   ```bash
   docker-compose restart
   ```

4. **Rebuild from scratch**:
   ```bash
   docker-compose down
   docker-compose up -d --build --force-recreate
   ```

---

## Performance Tuning

### Redis Memory

Edit `docker-compose.prod.yml`:

```yaml
redis:
  command: redis-server --maxmemory 1gb --maxmemory-policy allkeys-lru
```

### Nginx Worker Processes

Edit `docker/nginx/nginx.production.conf`:

```nginx
events {
    worker_connections 2048;  # Increase from 1024
}
```

### Server Resources

```bash
# Monitor resource usage
docker stats

# Limit container resources in docker-compose.prod.yml
server:
  deploy:
    resources:
      limits:
        cpus: '1.0'
        memory: 2G
```

---

## Security Checklist

- [ ] Changed all default passwords
- [ ] Using strong JWT secrets (32+ characters)
- [ ] Supabase RLS policies configured
- [ ] Security group limits SSH to your IP
- [ ] SSL certificate installed (production)
- [ ] Regular backups configured
- [ ] Monitoring/alerts set up
- [ ] `.env` file not committed to git
- [ ] Stripe webhook secrets configured
- [ ] Rate limiting enabled (nginx)

---

## Support

- **Documentation**: See README.md
- **Issues**: https://github.com/alexwebb-biz/relist/issues
- **Email**: support@relist.app

---

## License

[Your License Here]
