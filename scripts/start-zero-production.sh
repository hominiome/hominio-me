#!/bin/bash
# Production startup script for zero-cache
# This script configures zero-cache with optimal settings for production

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting Zero Cache for Production...${NC}"

# Check required environment variables
if [ -z "$ZERO_UPSTREAM_DB" ] && [ -z "$SECRET_ZERO_DEV_PG" ]; then
    echo -e "${RED}❌ Error: ZERO_UPSTREAM_DB or SECRET_ZERO_DEV_PG environment variable is required${NC}"
    exit 1
fi

if [ -z "$ZERO_AUTH_SECRET" ] && [ -z "$SECRET_ZERO_AUTH_SECRET" ]; then
    echo -e "${RED}❌ Error: ZERO_AUTH_SECRET or SECRET_ZERO_AUTH_SECRET environment variable is required${NC}"
    exit 1
fi

# Set defaults
DB_URL="${ZERO_UPSTREAM_DB:-$SECRET_ZERO_DEV_PG}"
AUTH_SECRET="${ZERO_AUTH_SECRET:-$SECRET_ZERO_AUTH_SECRET}"
REPLICA_FILE="${ZERO_REPLICA_FILE:-/data/zero-replica.db}"
SCHEMA_PATH="${ZERO_SCHEMA_PATH:-./src/zero-schema.ts}"

# Enhance database URL with connection pooling parameters
# This helps with high-latency connections
if [[ "$DB_URL" == *"neon.tech"* ]] || [[ "$DB_URL" == *"pooler"* ]]; then
    # Add connection timeout and pooling parameters
    if [[ "$DB_URL" != *"connect_timeout"* ]]; then
        DB_URL="${DB_URL}?connect_timeout=10&pool_timeout=10"
    fi
fi

echo -e "${GREEN}✅ Configuration:${NC}"
echo "  Database: ${DB_URL:0:30}..."
echo "  Replica File: $REPLICA_FILE"
echo "  Schema Path: $SCHEMA_PATH"

# Ensure replica file directory exists
mkdir -p "$(dirname "$REPLICA_FILE")"

# Set environment variables for zero-cache
export ZERO_UPSTREAM_DB="$DB_URL"
export ZERO_REPLICA_FILE="$REPLICA_FILE"
export ZERO_AUTH_SECRET="$AUTH_SECRET"
export ZERO_DB_CONNECT_TIMEOUT="10"

# Set Node.js memory limit to prevent OOM errors
export NODE_OPTIONS="--max-old-space-size=512"

# Start zero-cache with proper error handling
echo -e "${GREEN}🚀 Starting zero-cache...${NC}"

# Use exec to replace shell process, ensuring proper signal handling
exec npx zero-cache --schema-path="$SCHEMA_PATH" 2>&1 | while IFS= read -r line; do
    echo "[Zero] $line"
    
    # Check for critical errors
    if echo "$line" | grep -qi "error\|fatal\|panic"; then
        echo -e "${RED}[Zero ERROR] $line${NC}"
    fi
done

