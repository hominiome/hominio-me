# Cookie-Based Authentication Verification

This document verifies that the cookie-based authentication setup for BetterAuth + Zero sync is correctly configured according to [Zero's cookie-based auth documentation](https://zero.rocicorp.dev/docs/auth).

## ✅ Verification Checklist

### 1. Zero Client Configuration (✅ CORRECT)

**File:** `src/routes/alpha/+layout.svelte`

```typescript
zero = new Zero({
  server: zeroServerUrl,
  schema,
  userID: userId,
  mutators: createMutators(undefined),
  getQueriesURL: getMainDomainUrl('/alpha/api/zero/get-queries'),
  mutateURL: getMainDomainUrl('/alpha/api/zero/push'),
  // ⚠️ NO AUTH FUNCTION - we use cookie-based auth only
});
```

**Status:** ✅ **CORRECT** - No `auth` parameter, using cookie-based auth only.

**Zero Docs Requirement:** ✅ "If you use only custom mutators and synced queries, you can use cookie-based auth."

---

### 2. Zero-Cache Cookie Forwarding (✅ CORRECT)

**File:** `.github/workflows/deploy.yml` (production) and `src/lib/zero-manager.server.ts` (dev)

**Production (Fly.io secrets):**
```bash
ZERO_GET_QUERIES_FORWARD_COOKIES=true
ZERO_MUTATE_FORWARD_COOKIES=true
```

**Development (zero-manager.server.ts):**
```typescript
ZERO_GET_QUERIES_FORWARD_COOKIES: 'true',
ZERO_MUTATE_FORWARD_COOKIES: 'true',
```

**Dockerfile.sync (flags):**
```bash
--get-queries-forward-cookies
--mutate-forward-cookies
```

**Status:** ✅ **CORRECT** - Both cookie forwarding flags are set correctly.

**Zero Docs Requirement:** ✅ "Set `ZERO_GET_QUERIES_FORWARD_COOKIES=true` and `ZERO_MUTATE_FORWARD_COOKIES=true`"

---

### 3. Domain Configuration (✅ CORRECT)

**Requirements from Zero Docs:**
1. ✅ Run `zero-cache` on a subdomain of your main site
   - **Current:** `sync.hominio.me` (subdomain of `hominio.me`)
2. ✅ Set cookies with `Domain` attribute to parent domain
   - **Current:** `.hominio.me` (configured in `src/lib/auth.server.js`)

**File:** `src/lib/auth.server.js`
```typescript
advanced: {
  cookieDomain: '.hominio.me', // Enables cookie sharing across subdomains
}
```

**Status:** ✅ **CORRECT** - Cookies set for `.hominio.me` are accessible from `sync.hominio.me`.

---

### 4. Server Endpoints Cookie Reading (✅ CORRECT)

**Files:** 
- `src/routes/alpha/api/zero/get-queries/+server.ts`
- `src/routes/alpha/api/zero/push/+server.ts`

Both endpoints use:
```typescript
const authData = await extractAuthData(request);
```

**File:** `src/lib/server/auth-context.ts`
```typescript
export async function extractAuthData(request: Request): Promise<AuthData | undefined> {
  const session = await auth.api.getSession({
    headers: request.headers, // Reads cookies from request
  });
  // ...
}
```

**Status:** ✅ **CORRECT** - Server endpoints read BetterAuth session from forwarded cookies.

---

### 5. CORS Configuration (✅ CORRECT)

**Files:** Both `get-queries` and `push` endpoints

```typescript
if (origin && isTrustedOrigin(origin)) {
  headers['Access-Control-Allow-Origin'] = origin;
  headers['Access-Control-Allow-Credentials'] = 'true';
  headers['Access-Control-Allow-Headers'] = 'Content-Type, Cookie';
}
```

**Trusted Origins:** `src/lib/utils/domain.ts`
```typescript
return [
  `https://${baseDomain}`,      // https://hominio.me
  `https://${syncDomain}`,      // https://sync.hominio.me
];
```

**Status:** ✅ **CORRECT** - CORS allows credentials and includes both domains.

---

### 6. BetterAuth Configuration (✅ CORRECT)

**File:** `src/lib/auth.server.js`

```typescript
export const auth = betterAuth({
  database: { db: authDb, type: "postgres" },
  secret: SECRET_AUTH_SECRET,
  trustedOrigins: getTrustedOrigins(), // Includes sync.hominio.me
  advanced: {
    cookieDomain: '.hominio.me', // Enables cross-subdomain cookies
  },
});
```

**Status:** ✅ **CORRECT** - BetterAuth configured for cross-subdomain cookie sharing.

---

### 7. Deployment Pipeline (✅ CORRECT)

**File:** `.github/workflows/deploy.yml`

**Sync Service Secrets:**
```yaml
ZERO_GET_QUERIES_URL="https://hominio.me/alpha/api/zero/get-queries"
ZERO_PUSH_URL="https://hominio.me/alpha/api/zero/push"
ZERO_GET_QUERIES_FORWARD_COOKIES="true"
ZERO_MUTATE_FORWARD_COOKIES="true"
```

**Main App Secrets:**
```yaml
PUBLIC_DOMAIN="hominio.me"
PUBLIC_ZERO_SYNC_DOMAIN="sync.hominio.me"
```

**Status:** ✅ **CORRECT** - All required environment variables are set.

---

## ⚠️ Optional: ZERO_AUTH_SECRET

**Current Status:** We ARE setting `ZERO_AUTH_SECRET` in production, but according to Zero docs:

> "If you use only custom mutators and synced queries, you can use cookie-based auth. In this case, you do not need to set `ZERO_AUTH_SECRET`, `ZERO_AUTH_JWK`, or `ZERO_AUTH_JWKS_URL` on the server."

**Why we're setting it:**
- Used as `--admin-password` for zero-cache admin access (debugging)
- May be required by zero-cache even for cookie-based auth (defensive)
- Doesn't hurt to have it set

**Recommendation:** ✅ **KEEP IT** - It's used for admin password and doesn't interfere with cookie-based auth.

---

## 🔍 Flow Verification

### Cookie-Based Auth Flow (per Zero docs):

```
1. User logs in → BetterAuth sets cookie for .hominio.me
   ✅ Cookie domain: .hominio.me (accessible from sync.hominio.me)

2. Zero client connects to zero-cache (sync.hominio.me)
   ✅ Browser automatically sends cookies to sync.hominio.me (same parent domain)

3. Zero client calls synced query or mutator
   ✅ getQueriesURL/mutateURL point to hominio.me/alpha/api/zero/...

4. zero-cache forwards request to server with cookies
   ✅ ZERO_GET_QUERIES_FORWARD_COOKIES=true
   ✅ ZERO_MUTATE_FORWARD_COOKIES=true

5. Server reads BetterAuth session from cookies
   ✅ extractAuthData(request) reads cookies from headers

6. Server processes request with auth context
   ✅ Server mutators/queries use authData for permissions
```

**Status:** ✅ **ALL STEPS CORRECT**

---

## 📋 Summary

| Component | Status | Notes |
|-----------|--------|-------|
| Zero Client (no auth) | ✅ | No JWT/auth function |
| Cookie Forwarding | ✅ | Both flags set |
| Domain Setup | ✅ | Subdomain + parent domain cookies |
| Server Cookie Reading | ✅ | BetterAuth integration |
| CORS | ✅ | Credentials allowed |
| BetterAuth Config | ✅ | Cross-subdomain cookies enabled |
| Deployment | ✅ | All env vars set correctly |

**Overall Status:** ✅ **FULLY COMPLIANT** with Zero's cookie-based auth requirements.

---

## References

- [Zero Authentication Docs](https://zero.rocicorp.dev/docs/auth)
- [Zero Cookie-Based Auth Section](https://zero.rocicorp.dev/docs/auth#cookie-based-auth)
- [BetterAuth Cross-Subdomain Cookies](https://www.better-auth.com/docs)

