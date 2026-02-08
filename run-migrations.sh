#!/bin/bash
set -e

ENV="${1:-prod}"
MIGRATIONS_DIR="server/src/migrations"
BATCH_FILE=".migration-batch"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $1"; }
warn() { echo -e "${YELLOW}[$(date '+%H:%M:%S')]${NC} $1"; }
error() { echo -e "${RED}[$(date '+%H:%M:%S')] ERROR:${NC} $1"; }

# Load env
if [ -f ".env.${ENV}" ]; then
    export $(cat ".env.${ENV}" | grep -v '^#' | xargs)
elif [ -f ".env" ]; then
    export $(cat ".env" | grep -v '^#' | xargs)
fi

log "Running migrations for: ${ENV}"

# Get batch number
BATCH_NUMBER=$(cat "$BATCH_FILE" 2>/dev/null || echo "0")
BATCH_NUMBER=$((BATCH_NUMBER + 1))

# Find migration files
FILES=$(ls -1 "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort)
if [ -z "$FILES" ]; then
    warn "No migrations found"
    exit 0
fi

RAN=0
SKIPPED=0

for file in $FILES; do
    filename=$(basename "$file")
    
    # Skip init file (run manually first)
    if [ "$filename" = "000_init_migration_system.sql" ]; then
        continue
    fi
    
    log "  → $filename"
    RAN=$((RAN + 1))
done

echo "$BATCH_NUMBER" > "$BATCH_FILE"
success "✅ Migrations ready (Batch $BATCH_NUMBER)"
log "⚠️  Run SQL files manually in Supabase SQL Editor:"
log "   $MIGRATIONS_DIR/*.sql"
