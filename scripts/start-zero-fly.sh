#!/bin/bash
# Startup script for Zero cache on Fly.io
# This script ensures ports are clean before starting Zero

set -e

echo "🚀 [Zero] Starting Zero cache on Fly.io..."

# Check if ports are in use (shouldn't happen in Fly.io, but check anyway)
if command -v lsof >/dev/null 2>&1; then
    # Kill any process on port 4848
    if lsof -ti:4848 >/dev/null 2>&1; then
        echo "⚠️  [Zero] Port 4848 is in use, cleaning up..."
        lsof -ti:4848 | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
    
    # Kill any process on port 4849
    if lsof -ti:4849 >/dev/null 2>&1; then
        echo "⚠️  [Zero] Port 4849 is in use, cleaning up..."
        lsof -ti:4849 | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
fi

# Check required environment variables
if [ -z "$ZERO_UPSTREAM_DB" ] && [ -z "$SECRET_ZERO_DEV_PG" ]; then
    echo "❌ [Zero] ERROR: ZERO_UPSTREAM_DB or SECRET_ZERO_DEV_PG environment variable is required"
    exit 1
fi

if [ -z "$ZERO_AUTH_SECRET" ] && [ -z "$SECRET_ZERO_AUTH_SECRET" ]; then
    echo "❌ [Zero] ERROR: ZERO_AUTH_SECRET or SECRET_ZERO_AUTH_SECRET environment variable is required"
    exit 1
fi

# Set defaults
DB_URL="${ZERO_UPSTREAM_DB:-$SECRET_ZERO_DEV_PG}"
AUTH_SECRET="${ZERO_AUTH_SECRET:-$SECRET_ZERO_AUTH_SECRET}"
REPLICA_FILE="${ZERO_REPLICA_FILE:-/data/sync-replica.db}"
SCHEMA_PATH="${ZERO_SCHEMA_PATH:-./src/zero-schema.ts}"

# Enhance database URL with connection pooling parameters if needed
if [[ "$DB_URL" == *"neon.tech"* ]] || [[ "$DB_URL" == *"pooler"* ]]; then
    if [[ "$DB_URL" != *"connect_timeout"* ]]; then
        DB_URL="${DB_URL}?connect_timeout=15&pool_timeout=15"
    fi
fi

echo "✅ [Zero] Configuration ready"
echo "   Database: ${DB_URL:0:40}..."
echo "   Replica File: $REPLICA_FILE"
echo "   Schema Path: $SCHEMA_PATH"

# Ensure replica file directory exists
mkdir -p "$(dirname "$REPLICA_FILE")"

# Set environment variables for zero-cache
export ZERO_UPSTREAM_DB="$DB_URL"
export ZERO_REPLICA_FILE="$REPLICA_FILE"
export ZERO_AUTH_SECRET="$AUTH_SECRET"
export ZERO_DB_CONNECT_TIMEOUT="${ZERO_DB_CONNECT_TIMEOUT:-15}"
export PGCONNECT_TIMEOUT="${PGCONNECT_TIMEOUT:-15}"

# Set Bun memory limit to prevent OOM errors
export BUN_MAX_HEAP_SIZE="1024MB"

# Start zero-cache with proper error handling
echo "🚀 [Zero] Starting zero-cache process..."

# Use exec to replace shell process, ensuring proper signal handling
exec bunx zero-cache --schema-path="$SCHEMA_PATH" 2>&1 | while IFS= read -r line; do
    echo "[Zero] $line"
    
    # Check for critical errors
    if echo "$line" | grep -qiE "error|fatal|panic|EADDRINUSE"; then
        echo "❌ [Zero ERROR] $line"
        
        # If port conflict detected, log it but don't try to kill (Fly.io handles this)
        if echo "$line" | grep -qi "EADDRINUSE\|address already in use"; then
            echo "⚠️  [Zero] Port conflict detected. This may indicate multiple instances running."
            echo "⚠️  [Zero] Ensure only one machine is running: fly scale count 1 -a hominio-me-sync"
        fi
    fi
done

