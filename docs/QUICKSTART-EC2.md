# ReList - EC2 Quick Start

Get ReList running on AWS EC2 in under 10 minutes.

## Prerequisites

1. **EC2 Instance Running**
   - Instance type: `t3.medium` or larger
   - OS: Amazon Linux 2023 or Ubuntu 22.04
   - Storage: 20GB+

2. **Security Group**
   - Port 22 (SSH): Your IP
   - Port 80 (HTTP): 0.0.0.0/0
   - Port 443 (HTTPS): 0.0.0.0/0

3. **Credentials Ready**
   - Supabase URL + Keys ([Get here](https://app.supabase.com))
   - JWT secrets (generate with `openssl rand -base64 32`)

## Step 1: SSH into EC2

```bash
ssh -i your-key.pem ec2-user@YOUR_EC2_IP
```

## Step 2: Run Deployment Script

```bash
# Download script
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/relist/main/docs/deploy-ec2.sh -o deploy-ec2.sh

# Make executable
chmod +x deploy-ec2.sh

# Run it
./deploy-ec2.sh
```

## Step 3: Configure Environment

When prompted, edit `.env`:

```bash
nano ~/relist/.env
```

**Minimum required**:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_key_here
JWT_SECRET=your_secret_here_32_chars_min
JWT_REFRESH_SECRET=another_secret_here_32_chars_min

# For production with SSL:
DOMAIN=relist.yourdomain.com
NODE_ENV=production
LETSENCRYPT_EMAIL=your-email@example.com
```

Save and exit: `Ctrl+X`, then `Y`, then `Enter`

## Step 4: Continue Deployment

Press Enter to continue the script. It will:
- Build Docker images
- Start all containers
- Set up SSL (if production mode)

## Step 5: Access Your App

- **Development**: http://YOUR_EC2_IP
- **Production**: https://your-domain.com

## Useful Commands

```bash
cd ~/relist

# View logs
docker-compose logs -f

# Restart app
docker-compose restart

# Stop app
docker-compose down

# Update app
git pull && docker-compose up -d --build
```

## Troubleshooting

**Can't connect?**
- Check security group allows ports 80/443
- Check containers: `docker-compose ps`
- Check logs: `docker-compose logs`

**SSL not working?**
- Verify DNS: `nslookup your-domain.com`
- Check `NODE_ENV=production` in `.env`
- View nginx logs: `docker-compose logs nginx`

**Need help?**
- See full guide: [DEPLOYMENT.md](./DEPLOYMENT.md)
- Open issue: https://github.com/YOUR_USERNAME/relist/issues

## What Gets Installed

- Docker + Docker Compose
- Git
- ReList application (frontend + backend)
- Redis (for job queues)
- Nginx (reverse proxy)
- Certbot (SSL certificates)

All data is in Supabase Cloud - Redis is only for caching/queues.

## Next Steps

1. Configure optional integrations (Stripe, Telegram, eBay)
2. Set up monitoring/alerts
3. Configure backups
4. Test the application

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed documentation.
