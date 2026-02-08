#!/bin/bash
set -e

echo "🚀 Deploying ReList PRODUCTION environment..."

BRANCH="main"
COMPOSE_FILE="docker-compose.prod.yml"

cd /home/ubuntu/relist

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo "⚠️  Warning: Uncommitted changes detected"
fi

# Pull latest
echo "📥 Pulling main branch..."
git fetch origin
git checkout $BRANCH
git reset --hard origin/$BRANCH

COMMIT=$(git rev-parse --short HEAD)
echo "📦 Deploying commit: $COMMIT"

# Run migrations first
echo "🗄️  Running migrations..."
./run-migrations.sh prod || true

# Build and deploy
echo "🏗️  Building production..."
docker-compose -f $COMPOSE_FILE build
docker-compose -f $COMPOSE_FILE up -d

echo "⏳ Waiting for services..."
sleep 5

# Health check
echo "🏥 Health check..."
if curl -s http://localhost:3000/api/health > /dev/null; then
    echo "✅ Production is healthy!"
else
    echo "⚠️  Health check warning"
fi

echo ""
echo "✅ Production deployment complete!"
echo "🔗 https://relist-app.online"
echo "📝 Logs: docker logs relist-server"
