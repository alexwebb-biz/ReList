#!/bin/bash

# =============================================================================
# ReList - Quick Deploy Script
# =============================================================================
# Run this on EC2 to pull latest changes and rebuild
#
# Usage:
#   ./deploy.sh
# =============================================================================

set -e  # Exit on error

echo "🚀 Deploying latest changes..."
echo ""

# Pull latest code
echo "📥 Pulling from GitHub..."
git pull origin main

# Rebuild and restart
echo ""
echo "🔨 Rebuilding containers..."
sudo docker-compose -f docker-compose.prod.yml up -d --build

# Wait for services to be ready
echo ""
echo "⏳ Waiting for services..."
sleep 10

# Check status
echo ""
echo "📊 Container status:"
sudo docker-compose -f docker-compose.prod.yml ps

echo ""
echo "✅ Deployment complete!"
echo ""
echo "View logs: sudo docker-compose -f docker-compose.prod.yml logs -f"
echo "Check site: https://relist-app.online"
echo ""
