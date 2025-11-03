# DNS-Level Redirect Setup (www to non-www)

This guide explains how to set up a DNS-level redirect from `www.hominio.me` to `hominio.me` at your DNS provider level. The application code has been cleaned up to always use the non-www domain, so DNS-level redirect is required.

## Current Setup

- **Domain Registrar:** NameSilo
- **Current DNS:** Fly.io 3dns (ns1.3dns.box, ns2.3dns.box)
- **Fly.io IPs:**
  - IPv4: `66.241.124.145`
  - IPv6: `2a09:8280:1::aa:d39:0`

## Option 1: Use NameSilo DNS with URL Forwarding

### Step 1: Switch DNS from Fly.io 3dns to NameSilo

1. Log into your NameSilo account
2. Go to **Domain Manager** → Select `hominio.me`
3. Click **DNS Records** tab
4. Note the current nameservers (they should be `ns1.3dns.box` and `ns2.3dns.box`)

### Step 2: Configure DNS Records at NameSilo

Set up these DNS records:

**For hominio.me (root domain):**
```
Type: A
Host: @
Value: 66.241.124.145
TTL: 3600

Type: AAAA
Host: @
Value: 2a09:8280:1::aa:d39:0
TTL: 3600
```

**For www.hominio.me (redirect):**
```
Type: URL Redirect
Host: www
Value: https://hominio.me
Redirect Type: 301 (Permanent)
```

**OR if NameSilo doesn't support URL Redirect records:**
Use Cloudflare (recommended) - see Option 2 below.

### Step 3: Update Nameservers (if needed)

If NameSilo requires you to use their nameservers instead of Fly.io's 3dns:
1. Go to **Domain Manager** → `hominio.me` → **Nameservers**
2. Change to NameSilo's default nameservers:
   - `dns1.namesilo.com`
   - `dns2.namesilo.com`
   - `dns3.namesilo.com`
   - `dns4.namesilo.com`
   - `dns5.namesilo.com`

**⚠️ Important:** After changing nameservers, you'll need to remove the domain from Fly.io's 3dns management.

## Option 2: Use Cloudflare (Recommended for Redirect Support)

Cloudflare has excellent support for DNS-level redirects via Page Rules.

### Step 1: Transfer DNS to Cloudflare

1. Sign up at [cloudflare.com](https://cloudflare.com)
2. Add your domain `hominio.me`
3. Cloudflare will scan your current DNS records
4. Update nameservers at NameSilo to Cloudflare's nameservers (they'll provide these)

### Step 2: Configure DNS Records at Cloudflare

**For hominio.me:**
```
Type: A
Name: @
Content: 66.241.124.145
Proxy: Enabled (orange cloud)

Type: AAAA
Name: @
Content: 2a09:8280:1::aa:d39:0
Proxy: Enabled (orange cloud)
```

**For www.hominio.me:**
```
Type: CNAME
Name: www
Target: hominio.me
Proxy: Enabled (orange cloud)
```

### Step 3: Set Up Redirect Rule

1. Go to **Rules** → **Page Rules** (or **Redirect Rules** in newer dashboards)
2. Create a new rule:
   - **URL:** `www.hominio.me/*`
   - **Setting:** Forwarding URL
   - **Status Code:** 301 - Permanent Redirect
   - **Destination URL:** `https://hominio.me/$1`

## Option 3: Keep Fly.io 3dns (Not Recommended)

Fly.io's 3dns doesn't support DNS-level redirects. If you must use 3dns, you'll need to implement application-level redirects (which we've removed from the codebase). **We recommend using Cloudflare (Option 2) for DNS-level redirects.**

## Important Notes

1. **SSL Certificates:** After switching DNS providers, you may need to:
   - Remove certificates from Fly.io: `flyctl certs delete www.hominio.me --app hominio-me`
   - Or keep both domains pointing to Fly.io and let Fly.io handle SSL

2. **DNS Propagation:** Changes can take 24-48 hours to propagate globally

3. **Testing:** After setup, test with:
   ```bash
   curl -I http://www.hominio.me
   # Should return: HTTP/1.1 301 Moved Permanently
   # Location: https://hominio.me
   ```

4. **Code is clean:** All application code now always uses non-www domain. DNS-level redirect is required for proper www → non-www handling.

## Recommended Approach

**For best results with Fly.io:**
- Use **Cloudflare** as DNS provider (free tier is sufficient)
- Set up DNS-level redirect via Cloudflare Page Rules
- Keep A/AAAA records pointing to Fly.io IPs
- This gives you DNS-level redirects while still using Fly.io for hosting

