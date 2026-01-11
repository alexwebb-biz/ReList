#!/bin/bash

# =============================================================================
# RELIST - AWS EC2 Automated Deployment Script
# =============================================================================
# This script sets up a fresh EC2 instance with Docker and deploys the app
#
# Usage:
#   1. SSH into your EC2 instance
#   2. Run: curl -fsSL https://raw.githubusercontent.com/alexwebb-biz/relist/main/deploy-ec2.sh | bash
#   Or:
#   1. Copy this script to EC2: scp deploy-ec2.sh ec2-user@YOUR_IP:~
#   2. SSH and run: chmod +x deploy-ec2.sh && ./deploy-ec2.sh
# =============================================================================

set -e  # Exit on error

echo "========================================="
echo "🚀 RELIST EC2 Deployment"
echo "========================================="
echo ""

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------
REPO_URL="${REPO_URL:-https://github.com/alexwebb-biz/relist.git}"
BRANCH="${BRANCH:-main}"
APP_DIR="/home/$USER/relist"

# -----------------------------------------------------------------------------
# Check if running as root
# -----------------------------------------------------------------------------
if [ "$EUID" -eq 0 ]; then
    echo "❌ Please run as regular user, not root"
    echo "   Script will use sudo when needed"
    exit 1
fi

# -----------------------------------------------------------------------------
# Step 1: Update system
# -----------------------------------------------------------------------------
echo "📦 Updating system packages..."
sudo yum update -y || sudo apt-get update -y

# -----------------------------------------------------------------------------
# Step 2: Install Docker
# -----------------------------------------------------------------------------
echo ""
echo "🐳 Installing Docker..."

if ! command -v docker &> /dev/null; then
    # Check if Amazon Linux or Ubuntu
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        if [[ $ID == "amzn" ]]; then
            # Amazon Linux
            sudo yum install -y docker
            sudo systemctl start docker
            sudo systemctl enable docker
            sudo usermod -a -G docker $USER
        else
            # Ubuntu/Debian
            sudo apt-get install -y apt-transport-https ca-certificates curl software-properties-common
            curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
            sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu focal stable"
            sudo apt-get update
            sudo apt-get install -y docker-ce
            sudo systemctl start docker
            sudo systemctl enable docker
            sudo usermod -a -G docker $USER
        fi
    fi
    echo "✅ Docker installed"
else
    echo "✅ Docker already installed"
fi

# -----------------------------------------------------------------------------
# Step 3: Install Docker Compose
# -----------------------------------------------------------------------------
echo ""
echo "🔧 Installing Docker Compose..."

if ! command -v docker-compose &> /dev/null; then
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    echo "✅ Docker Compose installed"
else
    echo "✅ Docker Compose already installed"
fi

# -----------------------------------------------------------------------------
# Step 4: Install Git
# -----------------------------------------------------------------------------
echo ""
echo "📚 Installing Git..."

if ! command -v git &> /dev/null; then
    sudo yum install -y git || sudo apt-get install -y git
    echo "✅ Git installed"
else
    echo "✅ Git already installed"
fi

# -----------------------------------------------------------------------------
# Step 5: Clone repository
# -----------------------------------------------------------------------------
echo ""
echo "📥 Cloning repository..."

if [ -d "$APP_DIR" ]; then
    echo "⚠️  Directory $APP_DIR already exists"
    read -p "   Remove and re-clone? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf "$APP_DIR"
        git clone -b "$BRANCH" "$REPO_URL" "$APP_DIR"
        echo "✅ Repository cloned"
    else
        cd "$APP_DIR"
        git pull origin "$BRANCH"
        echo "✅ Repository updated"
    fi
else
    git clone -b "$BRANCH" "$REPO_URL" "$APP_DIR"
    echo "✅ Repository cloned"
fi

cd "$APP_DIR"

# -----------------------------------------------------------------------------
# Step 6: Configure environment
# -----------------------------------------------------------------------------
echo ""
echo "⚙️  Configuring environment..."

if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "✅ Created .env from template"
        echo ""
        echo "========================================="
        echo "⚠️  IMPORTANT: CONFIGURE YOUR .env FILE"
        echo "========================================="
        echo ""
        echo "Before proceeding, you MUST edit the .env file with your values:"
        echo ""
        echo "Required variables:"
        echo "  - DOMAIN (your domain or EC2 public IP)"
        echo "  - NODE_ENV (set to 'production' for SSL)"
        echo "  - LETSENCRYPT_EMAIL (your email for SSL certificates)"
        echo "  - SUPABASE_URL, SUPABASE_SERVICE_KEY"
        echo "  - JWT_SECRET, JWT_REFRESH_SECRET"
        echo ""
        echo "Optional variables:"
        echo "  - STRIPE_SECRET_KEY, TELEGRAM_BOT_TOKEN, EBAY_CLIENT_ID, etc."
        echo ""
        echo "Edit now with: nano .env"
        echo ""
        read -p "Press ENTER after you've configured .env..."
    else
        echo "❌ No .env.example found. Please create .env manually"
        exit 1
    fi
else
    echo "✅ .env file already exists"
fi

# -----------------------------------------------------------------------------
# Step 7: Detect environment and prepare SSL
# -----------------------------------------------------------------------------
echo ""
echo "🔍 Detecting environment..."

if grep -q "NODE_ENV=production" .env 2>/dev/null; then
    ENVIRONMENT="production"
    DOMAIN=$(grep "^DOMAIN=" .env | cut -d '=' -f2)
    EMAIL=$(grep "^LETSENCRYPT_EMAIL=" .env | cut -d '=' -f2)

    echo "📍 Environment: Production"
    echo "🌐 Domain: $DOMAIN"
    echo "📧 SSL Email: $EMAIL"

    # Update SSL config with actual domain
    sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" docker/nginx/ssl.conf

    echo ""
    echo "🔐 Setting up SSL certificates..."
    echo ""
    echo "⚠️  IMPORTANT: Before proceeding, ensure:"
    echo "   1. Your domain '$DOMAIN' points to this server's IP"
    echo "   2. Ports 80 and 443 are open in your security group"
    echo ""
    read -p "Continue with SSL setup? (y/N): " -n 1 -r
    echo

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Aborted. Configure your domain and security group, then run again."
        exit 1
    fi

    COMPOSE_FILE="docker-compose.prod.yml"
else
    ENVIRONMENT="development"
    echo "📍 Environment: Development (HTTP only)"
    COMPOSE_FILE="docker-compose.yml"
fi

# -----------------------------------------------------------------------------
# Step 8: Build and start containers
# -----------------------------------------------------------------------------
echo ""
echo "🔨 Building and starting containers..."

# Apply Docker group permissions (requires re-login to take effect)
if ! docker ps &> /dev/null; then
    echo "⚠️  Docker group permissions not active yet"
    echo "   Running with sudo for this session..."
    echo "   After deployment, logout and login again to use Docker without sudo"
    DOCKER_CMD="sudo docker-compose"
else
    DOCKER_CMD="docker-compose"
fi

# Stop existing containers
echo "   Stopping existing containers..."
$DOCKER_CMD -f $COMPOSE_FILE down 2>/dev/null || true

# Build and start
echo "   Building images (this may take a few minutes)..."
$DOCKER_CMD -f $COMPOSE_FILE build

echo "   Starting containers..."
$DOCKER_CMD -f $COMPOSE_FILE up -d

# -----------------------------------------------------------------------------
# Step 9: Setup SSL certificates (production only)
# -----------------------------------------------------------------------------
if [ "$ENVIRONMENT" = "production" ]; then
    echo ""
    echo "🔐 Obtaining SSL certificate..."

    # Wait for nginx to be ready
    sleep 10

    # Request certificate
    sudo docker run --rm \
        -v relist-certbot-data:/etc/letsencrypt \
        -v relist-certbot-www:/var/www/certbot \
        certbot/certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email "$EMAIL" \
        --agree-tos \
        --no-eff-email \
        -d "$DOMAIN"

    if [ $? -eq 0 ]; then
        echo "✅ SSL certificate obtained successfully"

        # Restart nginx to apply certificate
        echo "   Restarting nginx..."
        $DOCKER_CMD -f $COMPOSE_FILE restart nginx
    else
        echo "❌ Failed to obtain SSL certificate"
        echo "   Check that:"
        echo "   - Your domain DNS is correctly configured"
        echo "   - Ports 80 and 443 are accessible"
        echo "   - You haven't hit Let's Encrypt rate limits"
        echo ""
        echo "   You can try again later with:"
        echo "   docker run --rm -v relist-certbot-data:/etc/letsencrypt -v relist-certbot-www:/var/www/certbot certbot/certbot certonly --webroot --webroot-path=/var/www/certbot --email $EMAIL --agree-tos -d $DOMAIN"
    fi
fi

# -----------------------------------------------------------------------------
# Step 10: Verify deployment
# -----------------------------------------------------------------------------
echo ""
echo "🔍 Verifying deployment..."
sleep 5

CONTAINERS=$($DOCKER_CMD -f $COMPOSE_FILE ps -q | wc -l)
RUNNING=$($DOCKER_CMD -f $COMPOSE_FILE ps --filter "status=running" -q | wc -l)

echo "   Containers: $RUNNING/$CONTAINERS running"

if [ "$RUNNING" -eq "$CONTAINERS" ]; then
    echo "✅ All containers running successfully"
else
    echo "⚠️  Some containers are not running"
    echo "   Check logs with: docker-compose -f $COMPOSE_FILE logs"
fi

# -----------------------------------------------------------------------------
# Deployment complete
# -----------------------------------------------------------------------------
echo ""
echo "========================================="
echo "✅ DEPLOYMENT COMPLETE!"
echo "========================================="
echo ""

if [ "$ENVIRONMENT" = "production" ]; then
    echo "🌐 Your app is accessible at: https://$DOMAIN"
    echo "🔐 SSL: Enabled (Let's Encrypt)"
else
    IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "YOUR_IP")
    echo "🌐 Your app is accessible at: http://$IP"
    echo "🔐 SSL: Disabled (development mode)"
fi

echo ""
echo "Useful commands:"
echo "  View logs:        cd $APP_DIR && docker-compose -f $COMPOSE_FILE logs -f"
echo "  Stop app:         cd $APP_DIR && docker-compose -f $COMPOSE_FILE down"
echo "  Restart app:      cd $APP_DIR && docker-compose -f $COMPOSE_FILE restart"
echo "  Update app:       cd $APP_DIR && git pull && docker-compose -f $COMPOSE_FILE up -d --build"
echo ""

if [ "$ENVIRONMENT" = "production" ]; then
    echo "SSL certificate auto-renewal is configured and runs daily."
    echo ""
fi

echo "🎉 Happy selling with ReList!"
echo ""
