# Environment Variables Reference

## Overview

This document lists all environment variables needed for production deployment. The codebase now uses a **domain-based approach** that automatically handles both `hominio.me` and `www.hominio.me` domains.

## Domain Utility

The codebase uses `src/lib/utils/domain.ts` to automatically:
- Add `https://` protocol
- Handle both `www` and non-`www` variants
- Generate full URLs from domain names
- Manage trusted origins for CORS

## Environment Variables

### For Main App (`hominio.me`)

#### Required Public Variables (Domain Only)

```bash
# Main domain (without www, without protocol)
# Code automatically handles www.hominio.me and hominio.me
PUBLIC_DOMAIN=hominio.me

# Zero sync service domain (without protocol)
# Code automatically adds wss:// for WebSocket connections
PUBLIC_ZERO_SYNC_DOMAIN=sync.hominio.me
```

#### Required Secret Variables

```bash
# Database connections
SECRET_ZERO_DEV_PG=postgresql://user:pass@host/db
SECRET_NEON_PG_AUTH=postgresql://user:pass@host/db

# BetterAuth configuration
SECRET_AUTH_SECRET=your-secret-key-min-32-chars
SECRET_GOOGLE_CLIENT_ID=your-google-client-id  # Optional
SECRET_GOOGLE_CLIENT_SECRET=your-google-client-secret  # Optional

# Admin user ID
ADMIN=your-admin-user-id

# Zero authentication secret (shared with sync service)
SECRET_ZERO_AUTH_SECRET=your-zero-auth-secret-min-32-chars
```

#### Optional Override Variables

These can override the domain-based URLs if needed:

```bash
# Override Zero callbacks (normally auto-generated from PUBLIC_DOMAIN)
# Always use non-www domain - client code automatically uses non-www for Zero callbacks
SECRET_ZERO_GET_QUERIES_URL=https://hominio.me/alpha/api/zero/get-queries
SECRET_ZERO_PUSH_URL=https://hominio.me/alpha/api/zero/push
```

### For Zero Sync Service (`sync.hominio.me`)

#### Required Variables

```bash
# Database connection
ZERO_UPSTREAM_DB=postgresql://user:pass@host/db

# Zero authentication secret (must match main app)
ZERO_AUTH_SECRET=your-zero-auth-secret-min-32-chars

# Zero replica file path (persistent storage)
ZERO_REPLICA_FILE=/data/zero-replica.db

# Callback URLs to main app (normally auto-generated, but set explicitly for sync service)
# Always use non-www domain (hominio.me) - client code automatically uses non-www for Zero callbacks
ZERO_GET_QUERIES_URL=https://hominio.me/alpha/api/zero/get-queries
ZERO_PUSH_URL=https://hominio.me/alpha/api/zero/push

# Cookie forwarding (required for authentication)
ZERO_GET_QUERIES_FORWARD_COOKIES=true
ZERO_MUTATE_FORWARD_COOKIES=true

# Optional settings
ZERO_DB_CONNECT_TIMEOUT=10
NODE_ENV=production
```

## How It Works

### Domain Handling

1. **Client-side (`src/routes/alpha/+layout.svelte`)**:
   - Reads `PUBLIC_DOMAIN` and `PUBLIC_ZERO_SYNC_DOMAIN`
   - Detects if user is on `www.hominio.me` or `hominio.me`
   - Automatically uses the correct domain variant
   - Generates URLs with `https://` protocol

2. **Server-side (`src/lib/auth.server.js`, API endpoints)**:
   - Uses `getTrustedOrigins()` to allow both domains
   - CORS headers accept both `www` and non-`www` origins
   - BetterAuth cookies work across both domains

3. **Zero Manager (`src/lib/zero-manager.server.ts`)**:
   - Generates callback URLs from `PUBLIC_DOMAIN` in production
   - Falls back to `localhost` in development

### Example URLs Generated

From `PUBLIC_DOMAIN=hominio.me`:
- `https://hominio.me/alpha/api/zero/get-queries`
- `https://hominio.me/alpha/api/zero/push`
- If user is on `www.hominio.me`, URLs use `www.hominio.me` automatically

From `PUBLIC_ZERO_SYNC_DOMAIN=sync.hominio.me`:
- `wss://sync.hominio.me` (WebSocket connection)

## GitHub Actions Setup

The `.github/workflows/deploy.yml` workflow automatically sets these variables. You only need to ensure GitHub secrets are configured:

### Required GitHub Secrets

```
FLY_API_TOKEN
SECRET_ZERO_DEV_PG
SECRET_NEON_PG_AUTH
SECRET_AUTH_SECRET
SECRET_GOOGLE_CLIENT_ID (optional)
SECRET_GOOGLE_CLIENT_SECRET (optional)
SECRET_ZERO_AUTH_SECRET
ADMIN
```

The workflow sets domain variables automatically:
- `PUBLIC_DOMAIN=hominio.me`
- `PUBLIC_ZERO_SYNC_DOMAIN=sync.hominio.me`

## Migration from Old Variables

If you have old environment variables, here's the mapping:

| Old Variable | New Variable | Notes |
|-------------|--------------|-------|
| `PUBLIC_BASE_URL=https://hominio.me` | `PUBLIC_DOMAIN=hominio.me` | Remove protocol and www |
| `PUBLIC_ZERO_SERVER=wss://sync.hominio.me` | `PUBLIC_ZERO_SYNC_DOMAIN=sync.hominio.me` | Remove protocol |
| `SECRET_ZERO_GET_QUERIES_URL=...` | (Optional override) | Auto-generated from `PUBLIC_DOMAIN` |
| `SECRET_ZERO_PUSH_URL=...` | (Optional override) | Auto-generated from `PUBLIC_DOMAIN` |

## Benefits

1. **Single Source of Truth**: Only set domain once, code handles the rest
2. **WWW Support**: Automatically handles both `www` and non-`www` domains
3. **Cleaner Config**: No need to repeat full URLs everywhere
4. **Easier Updates**: Change domain in one place, everything updates

