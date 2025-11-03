# Production Deployment Guide

## Overview

This guide covers deploying the Hominio application to Fly.io with:
- **Main App**: `hominio.me` (SvelteKit fullstack app)
- **Zero Sync Service**: `sync.hominio.me` (Zero-cache server)

## Required Environment Variables

### For SvelteKit App (`hominio.me`)

#### Database Connections
```bash
# Zero database (PostgreSQL) - same as sync service
SECRET_ZERO_DEV_PG=postgresql://user:pass@host/db

# Auth database (PostgreSQL) - BetterAuth database
SECRET_NEON_PG_AUTH=postgresql://user:pass@host/db
```

#### BetterAuth Configuration
```bash
# BetterAuth secret (generate with: openssl rand -base64 32)
SECRET_AUTH_SECRET=your-secret-key-min-32-chars

# Google OAuth (optional, for social login)
SECRET_GOOGLE_CLIENT_ID=your-google-client-id
SECRET_GOOGLE_CLIENT_SECRET=your-google-client-secret
```

#### Admin Configuration
```bash
# User ID of admin user (matches BetterAuth user.id)
ADMIN=your-admin-user-id
```

#### Zero Sync Service Configuration
```bash
# Domain-based configuration (automatically handles www and non-www)
PUBLIC_DOMAIN=hominio.me
PUBLIC_ZERO_SYNC_DOMAIN=sync.hominio.me

# Optional: Override URLs if needed (normally auto-generated from domains above)
SECRET_ZERO_GET_QUERIES_URL=https://hominio.me/alpha/api/zero/get-queries
SECRET_ZERO_PUSH_URL=https://hominio.me/alpha/api/zero/push
```

#### Zero Configuration
```bash
# Zero auth secret (shared between app and sync service)
SECRET_ZERO_AUTH_SECRET=your-zero-auth-secret-min-32-chars
```

### For Zero Sync Service (`sync.hominio.me`)

#### Database Connection
```bash
# Zero database (PostgreSQL) - same as main app
ZERO_UPSTREAM_DB=postgresql://user:pass@host/db
```

#### Zero Configuration
```bash
# Zero auth secret (must match main app)
ZERO_AUTH_SECRET=your-zero-auth-secret-min-32-chars

# Zero replica file path (persistent storage)
ZERO_REPLICA_FILE=/data/zero-replica.db
```

#### Callback URLs (to main app)
```bash
# URLs zero-cache calls back to for synced queries and mutators
ZERO_GET_QUERIES_URL=https://hominio.me/alpha/api/zero/get-queries
ZERO_PUSH_URL=https://hominio.me/alpha/api/zero/push

# Enable cookie forwarding for authentication
ZERO_GET_QUERIES_FORWARD_COOKIES=true
ZERO_MUTATE_FORWARD_COOKIES=true
```

#### Optional Zero Settings
```bash
# Database connection timeout (seconds)
ZERO_DB_CONNECT_TIMEOUT=10

# Node environment
NODE_ENV=production
```

## BetterAuth Cookie Domain Configuration

For cross-subdomain authentication (`hominio.me` ↔ `sync.hominio.me`), BetterAuth cookies must be configured to share across subdomains.

### Update `src/lib/auth.server.js`

```javascript
import { betterAuth } from "better-auth";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { getRequestEvent } from "$app/server";
import { env } from "$env/dynamic/private";
import { getAuthDb } from "$lib/db.server.js";

const SECRET_GOOGLE_CLIENT_ID = env.SECRET_GOOGLE_CLIENT_ID || "";
const SECRET_GOOGLE_CLIENT_SECRET = env.SECRET_GOOGLE_CLIENT_SECRET || "";
const SECRET_AUTH_SECRET = env.SECRET_AUTH_SECRET || "dev-secret-key-change-in-production";

const authDb = getAuthDb();

import { getTrustedOrigins } from "$lib/utils/domain";

export const auth = betterAuth({
  database: {
    db: authDb,
    type: "postgres",
  },
  secret: SECRET_AUTH_SECRET,
  // Don't set baseURL - let BetterAuth auto-detect from request origin
  // This allows both hominio.me and www.hominio.me to work
  trustedOrigins: getTrustedOrigins(), // Automatically includes www and sync subdomain
  socialProviders: {
    google: {
      clientId: SECRET_GOOGLE_CLIENT_ID,
      clientSecret: SECRET_GOOGLE_CLIENT_SECRET,
    },
  },
  plugins: [sveltekitCookies(getRequestEvent)],
  advanced: {
    // Set cookie domain to parent domain for cross-subdomain sharing
    cookiePrefix: "__better-auth",
    // Cookies will be set for .hominio.me (parent domain)
    // This allows cookies to be shared across hominio.me and sync.hominio.me
  },
});
```

### Add Domain Environment Variables

```bash
# In SvelteKit app (domain-only, no protocol)
PUBLIC_DOMAIN=hominio.me
PUBLIC_ZERO_SYNC_DOMAIN=sync.hominio.me
```

### Cookie Configuration Notes

1. **Domain Sharing**: BetterAuth cookies must be set for `.hominio.me` (parent domain) to be accessible from both `hominio.me` and `sync.hominio.me`
2. **Secure Cookies**: In production, ensure cookies are:
   - `Secure` (HTTPS only)
   - `SameSite=None` or `SameSite=Lax` (for cross-subdomain)
   - Domain set to `.hominio.me`

3. **BetterAuth Settings**: The `advanced.cookiePrefix` helps, but BetterAuth should automatically set cookies for the correct domain based on `baseURL` and `trustedOrigins`.

## GitHub Actions Setup

### Option 1: Set Secrets in GitHub and Deploy via Fly CLI

1. **Set GitHub Secrets** (Settings → Secrets and variables → Actions):
   ```
   FLY_API_TOKEN=your-fly-api-token
   ```

2. **Set Fly.io Secrets** (via Fly CLI or dashboard):
   ```bash
   # For main app
   fly secrets set SECRET_ZERO_DEV_PG="..." --app hominio-me
   fly secrets set SECRET_NEON_PG_AUTH="..." --app hominio-me
   fly secrets set SECRET_AUTH_SECRET="..." --app hominio-me
   fly secrets set SECRET_GOOGLE_CLIENT_ID="..." --app hominio-me
   fly secrets set SECRET_GOOGLE_CLIENT_SECRET="..." --app hominio-me
   fly secrets set SECRET_ZERO_AUTH_SECRET="..." --app hominio-me
   fly secrets set ADMIN="..." --app hominio-me
   fly secrets set PUBLIC_ZERO_SERVER="wss://sync.hominio.me" --app hominio-me
   fly secrets set SECRET_ZERO_GET_QUERIES_URL="https://hominio.me/alpha/api/zero/get-queries" --app hominio-me
   fly secrets set SECRET_ZERO_PUSH_URL="https://hominio.me/alpha/api/zero/push" --app hominio-me
   fly secrets set PUBLIC_BASE_URL="https://hominio.me" --app hominio-me

   # For sync service
   fly secrets set ZERO_UPSTREAM_DB="..." --app hominio-me-sync
   fly secrets set ZERO_AUTH_SECRET="..." --app hominio-me-sync
   fly secrets set ZERO_GET_QUERIES_URL="https://hominio.me/alpha/api/zero/get-queries" --app hominio-me-sync
   fly secrets set ZERO_PUSH_URL="https://hominio.me/alpha/api/zero/push" --app hominio-me-sync
   fly secrets set ZERO_GET_QUERIES_FORWARD_COOKIES="true" --app hominio-me-sync
   fly secrets set ZERO_MUTATE_FORWARD_COOKIES="true" --app hominio-me-sync
   ```

### Option 2: GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Fly.io

on:
  push:
    branches: [main]

jobs:
  deploy-app:
    name: Deploy SvelteKit App
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: superfly/flyctl-actions/setup-flyctl@master
      
      - name: Deploy to Fly.io
        run: flyctl deploy --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
          # Note: Secrets are set in Fly.io, not here
          # This workflow just triggers deployment
```

## Fly.io Configuration

### Main App (`hominio.me`)

#### `fly.toml` Updates

```toml
app = 'hominio-me'
primary_region = 'fra'

[build]

[env]
PORT = '3000'
PUBLIC_BASE_URL = 'https://hominio.me'
PUBLIC_ZERO_SERVER = 'wss://sync.hominio.me'

[http_service]
internal_port = 3000
force_https = true
auto_stop_machines = 'stop'
auto_start_machines = true
min_machines_running = 0
processes = ['app']

[[vm]]
memory = '1gb'
cpu_kind = 'shared'
cpus = 1
```

#### Deploy Main App

```bash
fly deploy --app hominio-me
```

### Zero Sync Service (`sync.hominio.me`)

#### Create Separate Fly App

```bash
# Create new Fly app for sync service
fly apps create hominio-me-sync

# Create fly.toml for sync service
```

#### `fly.toml` for Sync Service

```toml
app = 'hominio-me-sync'
primary_region = 'fra'

[build]
# Build from same repo, but use different Dockerfile/start command

[env]
PORT = '4848'
NODE_ENV = 'production'

[http_service]
internal_port = 4848
force_https = true
auto_stop_machines = 'stop'
auto_start_machines = true
min_machines_running = 1  # Keep sync service always running
processes = ['sync']

[[vm]]
memory = '512mb'
cpu_kind = 'shared'
cpus = 1

[[mounts]]
source = "zero_replica"
destination = "/data"
```

#### Create Volume for Zero Replica

```bash
fly volumes create zero_replica --size 1 --app hominio-me-sync --region fra
```

#### Deploy Sync Service

```bash
fly deploy --app hominio-me-sync
```

## DNS Configuration

### Main App
```
hominio.me → hominio-me.fly.dev (or use custom domain)
```

### Sync Service
```
sync.hominio.me → hominio-me-sync.fly.dev (or use custom domain)
```

## Testing Production Setup

1. **Test Cookie Sharing**:
   - Log in on `hominio.me`
   - Verify cookies are accessible from `sync.hominio.me`
   - Check browser DevTools → Application → Cookies → Domain should be `.hominio.me`

2. **Test Zero Connection**:
   - Open browser console on `hominio.me`
   - Verify WebSocket connects to `wss://sync.hominio.me`
   - Check for authentication errors

3. **Test Mutations**:
   - Perform an action that triggers a mutation (e.g., add project to cup)
   - Verify no "Unauthorized" errors in server logs
   - Check that mutations succeed

## Troubleshooting

### Cookies Not Shared Across Subdomains

**Problem**: BetterAuth cookies not accessible from `sync.hominio.me`

**Solution**:
1. Verify `baseURL` and `trustedOrigins` in `auth.server.js`
2. Check cookie domain in browser DevTools (should be `.hominio.me`)
3. Ensure cookies are `Secure` and `SameSite` settings allow cross-subdomain

### Zero Sync Service Can't Authenticate

**Problem**: Zero-cache requests to `/get-queries` or `/push` return 401

**Solution**:
1. Verify `ZERO_GET_QUERIES_FORWARD_COOKIES=true` and `ZERO_MUTATE_FORWARD_COOKIES=true`
2. Check that cookies are being forwarded in zero-cache logs
3. Verify `SECRET_AUTH_SECRET` matches between app and sync service

### WebSocket Connection Fails

**Problem**: Client can't connect to `wss://sync.hominio.me`

**Solution**:
1. Verify `PUBLIC_ZERO_SERVER=wss://sync.hominio.me` is set
2. Check Fly.io DNS configuration for `sync.hominio.me`
3. Verify zero-cache is running and listening on port 4848
4. Check Fly.io firewall/network rules

## Security Checklist

- [ ] All secrets stored in Fly.io secrets (not in code)
- [ ] `SECRET_AUTH_SECRET` is strong (32+ characters, random)
- [ ] `SECRET_ZERO_AUTH_SECRET` is strong and matches between services
- [ ] HTTPS enforced (`force_https = true`)
- [ ] Cookies are `Secure` and `HttpOnly`
- [ ] `ADMIN` user ID is set correctly
- [ ] Database connection strings use SSL
- [ ] CORS/trustedOrigins configured correctly

## Notes

- **Shared Secrets**: `SECRET_ZERO_AUTH_SECRET` must be identical between main app and sync service
- **Database**: Both services can use the same PostgreSQL database
- **Cookie Domain**: BetterAuth automatically sets cookies for parent domain when `baseURL` is configured correctly
- **Zero Replica**: Sync service needs persistent storage for `zero-replica.db` (use Fly volumes)

