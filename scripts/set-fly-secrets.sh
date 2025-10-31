#!/bin/bash

# Helper script to set Fly.io secrets from .env file
# Usage: bash scripts/set-fly-secrets.sh

set -e

echo "🚀 Setting Fly.io secrets for authentication..."

# Check if .env exists
if [ ! -f .env ]; then
  echo "❌ Error: .env file not found"
  exit 1
fi

# Load env vars from .env
export $(grep -v '^#' .env | xargs)

# Check required variables
if [ -z "$SECRET_GOOGLE_CLIENT_ID" ]; then
  echo "❌ Error: SECRET_GOOGLE_CLIENT_ID not found in .env"
  exit 1
fi

if [ -z "$SECRET_GOOGLE_CLIENT_SECRET" ]; then
  echo "❌ Error: SECRET_GOOGLE_CLIENT_SECRET not found in .env"
  exit 1
fi

if [ -z "$SECRET_NEON_PG_AUTH" ]; then
  echo "❌ Error: SECRET_NEON_PG_AUTH not found in .env"
  exit 1
fi

# Generate a secure random secret for production auth
AUTH_SECRET=$(openssl rand -base64 32)

echo "📝 Setting secrets on Fly.io..."

# Set all secrets at once
flyctl secrets set \
  SECRET_GOOGLE_CLIENT_ID="$SECRET_GOOGLE_CLIENT_ID" \
  SECRET_GOOGLE_CLIENT_SECRET="$SECRET_GOOGLE_CLIENT_SECRET" \
  SECRET_NEON_PG_AUTH="$SECRET_NEON_PG_AUTH" \
  SECRET_AUTH_SECRET="$AUTH_SECRET"

echo "✅ All secrets set successfully!"
echo ""
echo "🔍 Verify with: flyctl secrets list"
echo ""
echo "⚠️  Note: Setting secrets will restart your app"

