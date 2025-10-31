# DNS Setup for sync.hominio.me

## ✅ Certificate Added

The SSL certificate has been added to Fly.io for `sync.hominio.me`.

## 📋 DNS Configuration Required

Add the following DNS record at your domain registrar (where you manage hominio.me):

### CNAME Record (Recommended)
```
Type:  CNAME
Name:  sync
Value: l29nxq2.hominio-me-sync.fly.dev
```

### Alternative: A and AAAA Records
If CNAME is not available:
```
Type:  A
Name:  sync
Value: 66.241.125.201

Type:  AAAA
Name:  sync
Value: 2a09:8280:1::ab:6bd1:0
```

## ⏳ Next Steps

1. **Add DNS record** at your domain registrar
2. **Wait for DNS propagation** (usually 5-30 minutes)
3. **Verify DNS**: 
   ```bash
   dig sync.hominio.me CNAME
   # Should show: l29nxq2.hominio-me-sync.fly.dev
   ```
4. **Check certificate status**:
   ```bash
   fly certs check sync.hominio.me --app hominio-me-sync
   ```
   Wait until it shows "Issued" status.

5. **Update main app** to use the custom domain:
   ```bash
   fly secrets set PUBLIC_ZERO_SERVER="https://sync.hominio.me" --app hominio-me
   ```

## 🔍 Verify Setup

After DNS propagates and certificate is issued:
```bash
# Check certificate
fly certs check sync.hominio.me --app hominio-me-sync

# Test the endpoint
curl https://sync.hominio.me
# Should return "OK" or similar response

# Verify main app is using the correct URL
fly secrets list --app hominio-me | grep ZERO
```

## 📝 Current Status

- ✅ Certificate added to Fly.io
- ⏳ DNS record needs to be added at domain registrar
- ⏳ Waiting for DNS propagation and certificate issuance
- ⏳ Main app PUBLIC_ZERO_SERVER needs to be updated after DNS is ready

