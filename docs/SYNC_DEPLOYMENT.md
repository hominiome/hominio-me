# Fly.io Deployment Guide for Sync Service

## Overview
The sync service runs Zero cache server as a separate Fly.io app called `hominio-me-sync`.

## Initial Setup (One-time)

### 1. Create the Fly.io app
```bash
fly apps create hominio-me-sync
```

### 2. Create persistent volume for SQLite database
```bash
fly volumes create sync_sqlite_db --size 10 --region fra --app hominio-me-sync
```

### 3. Set environment variables/secrets

Set these secrets in Fly.io for the sync service:
```bash
# Set database connection (use the same as main app)
fly secrets set ZERO_UPSTREAM_DB="postgresql://..." --app hominio-me-sync

# Set auth secret (must match SECRET_ZERO_AUTH_SECRET in main app)
fly secrets set ZERO_AUTH_SECRET="your-secret-key" --app hominio-me-sync
```

### 4. Deploy sync service
```bash
fly deploy --config fly.sync.toml --app hominio-me-sync
```

### 5. Set PUBLIC_ZERO_SERVER in main app
```bash
# After sync service is deployed, get its URL
fly status --app hominio-me-sync

# Set the public URL in main app secrets
fly secrets set PUBLIC_ZERO_SERVER="https://hominio-me-sync.fly.dev" --app hominio-me
```

## Where to Set Environment Variables

### For Sync Service (`hominio-me-sync`):
Use Fly.io secrets:
```bash
fly secrets set ZERO_UPSTREAM_DB="..." --app hominio-me-sync
fly secrets set ZERO_AUTH_SECRET="..." --app hominio-me-sync
```

Or via Fly.io dashboard:
1. Go to https://fly.io/apps/hominio-me-sync
2. Settings → Secrets
3. Add secrets there

### For Main App (`hominio-me`):
Use Fly.io secrets:
```bash
fly secrets set PUBLIC_ZERO_SERVER="https://hominio-me-sync.fly.dev" --app hominio-me
```

This will be available as `PUBLIC_ZERO_SERVER` in your SvelteKit app.

## Setting Up Subdomain (sync.hominio.me)

After sync service is deployed, run:
```bash
fly certs add sync.hominio.me --app hominio-me-sync
```

Then update DNS:
- Add CNAME record: `sync.hominio.me` → `hominio-me-sync.fly.dev`

After DNS propagates, update PUBLIC_ZERO_SERVER:
```bash
fly secrets set PUBLIC_ZERO_SERVER="https://sync.hominio.me" --app hominio-me
```

## Maintenance

### Deploy Permissions (when schema changes)
```bash
npx zero-deploy-permissions --schema-path='./src/zero-schema.ts' --output-file='/tmp/permissions.sql'
fly postgres connect -a <your-postgres-app> -d <database-name>
# Then paste the SQL from /tmp/permissions.sql
```

### View Sync Service Logs
```bash
fly logs --app hominio-me-sync
```

### Restart Sync Service
```bash
fly apps restart hominio-me-sync
```
