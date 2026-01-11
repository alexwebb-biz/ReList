#!/bin/bash

# =============================================================================
# ReList - Remote Deploy Script
# =============================================================================
# Run this on your LOCAL machine to deploy to EC2
#
# Usage:
#   ./deploy-remote.sh
#
# Prerequisites:
#   - Set EC2_HOST, EC2_USER, EC2_KEY in this file
#   - Or set them as environment variables
# =============================================================================

# Configuration (update these)
EC2_HOST="${EC2_HOST:-YOUR_EC2_IP}"
EC2_USER="${EC2_USER:-ubuntu}"
EC2_KEY="${EC2_KEY:-~/.ssh/your-key.pem}"

echo "🚀 Deploying to EC2: $EC2_USER@$EC2_HOST"
echo ""

# Push to GitHub
echo "📤 Pushing to GitHub..."
git push origin main

# Deploy on EC2
echo ""
echo "📥 Deploying on EC2..."
ssh -i "$EC2_KEY" "$EC2_USER@$EC2_HOST" << 'ENDSSH'
  cd ~/relist
  echo "📥 Pulling latest code..."
  git pull origin main

  echo "🔨 Rebuilding containers..."
  sudo docker-compose -f docker-compose.prod.yml up -d --build

  echo "⏳ Waiting for services..."
  sleep 10

  echo "📊 Container status:"
  sudo docker-compose -f docker-compose.prod.yml ps

  echo ""
  echo "✅ Deployment complete!"
ENDSSH

echo ""
echo "🎉 Deployed successfully!"
echo "🌐 Check: https://relist-app.online"
echo ""
