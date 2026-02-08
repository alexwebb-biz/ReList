#!/bin/bash
set -e

echo "🚀 Deploying ReList TEST environment..."

BRANCH="test"
COMPOSE_FILE="docker-compose.test.yml"

cd /home/ubuntu/relist

# Pull latest
echo "📥 Pulling test branch..."
git fetch origin
git checkout $BRANCH || git checkout -b $BRANCH
git reset --hard origin/$BRANCH

COMMIT=$(git rev-parse --short HEAD)
echo "📦 Deploying commit: $COMMIT"

# Run migrations
echo "🗄️  Checking migrations..."
./run-migrations.sh test || true

# Build and deploy
echo "🏗️  Building test environment..."
docker-compose -f $COMPOSE_FILE build --no-cache
docker-compose -f $COMPOSE_FILE down
docker-compose -f $COMPOSE_FILE up -d

echo "⏳ Waiting for services..."
sleep 10

# Health check
echo "🏥 Health check..."
if curl -s http://localhost:8080 > /dev/null; then
    echo "✅ Test environment is healthy!"
else
    echo "⚠️  Health check warning - check logs: docker logs relist-server-test"
fi

echo ""
echo "✅ Test deployment complete!"
echo "🔗 http://test.relist-app.online (or http://YOUR_IP:8080)"
echo "📝 Logs: docker logs relist-server-test"
