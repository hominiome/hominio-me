# Quick Setup Guide: Sync Service

## 🎯 Where to Set Environment Variables

### Option 1: Using Fly.io CLI (Recommended)

**For Sync Service (`hominio-me-sync`):**
```bash
# Database connection (same as your main app's database)
fly secrets set ZERO_UPSTREAM_DB="postgresql://user:pass@host/db" --app hominio-me-sync

# Auth secret (must match SECRET_ZERO_AUTH_SECRET in main app)
fly secrets set ZERO_AUTH_SECRET="your-secret-key-here" --app hominio-me-sync
```

**For Main App (`hominio-me`):**
```bash
# Point to sync service URL
fly secrets set PUBLIC_ZERO_SERVER="https://hominio-me-sync.fly.dev" --app hominio-me
```

### Option 2: Using Fly.io Dashboard

1. Go to https://fly.io/apps
2. Click on the app (`hominio-me-sync` or `hominio-me`)
3. Go to **Settings** → **Secrets**
4. Click **Add Secret**
5. Enter key/value pairs

## 📋 Setup Checklist

### Initial Setup (One-time):
- [ ] Create sync app: `fly apps create hominio-me-sync`
- [ ] Create volume: `fly volumes create sync_sqlite_db --size 10 --region fra --app hominio-me-sync`
- [ ] Set ZERO_UPSTREAM_DB secret for sync app
- [ ] Set ZERO_AUTH_SECRET secret for sync app
- [ ] Deploy sync service: `fly deploy --config fly.sync.toml --app hominio-me-sync`
- [ ] Set PUBLIC_ZERO_SERVER secret for main app
- [ ] Verify sync service is running: `fly status --app hominio-me-sync`

### For Subdomain (sync.hominio.me):
- [x] Add certificate: `fly certs add sync.hominio.me --app hominio-me-sync`
- [ ] Add DNS CNAME: `sync` → `l29nxq2.hominio-me-sync.fly.dev`
- [ ] Wait for DNS propagation and certificate issuance (5-30 minutes)
- [ ] Verify certificate: `fly certs check sync.hominio.me --app hominio-me-sync`
- [ ] Update PUBLIC_ZERO_SERVER: `fly secrets set PUBLIC_ZERO_SERVER="https://sync.hominio.me" --app hominio-me`

## 🔍 Verify Setup

### Check Sync Service:
```bash
fly status --app hominio-me-sync
fly logs --app hominio-me-sync
```

### Check Main App Secrets:
```bash
fly secrets list --app hominio-me
```

### Test Connection:
Visit `https://hominio-me-sync.fly.dev` (or `https://sync.hominio.me` after DNS setup)
Should see "OK" if working correctly.
