# Authorization Fix - Project Create/Edit

## Problem

Project create and edit operations were failing with:
```
Unauthorized: Must be logged in to update projects
```

Even when users were logged in, the authorization was failing.

## Root Cause

Two issues were preventing proper authorization:

### 1. JWT Authentication Was Enabled (Wrong Architecture)

The Zero client was configured with a JWT `auth` function:

```typescript
// ❌ WRONG - Using JWT authentication
zero = new Zero({
  // ...
  auth: async () => {
    const response = await fetch("/alpha/api/zero-auth");
    const { token } = await response.json();
    return token;
  }
});
```

This caused the browser to send JWT tokens instead of cookies to zero-cache, and JWT tokens were not being read by our auth system.

### 2. Wrong Environment Variable Name

The environment variable for cookie forwarding was incorrect:

```typescript
// ❌ WRONG
ZERO_PUSH_FORWARD_COOKIES: 'true'

// ✅ CORRECT
ZERO_MUTATE_FORWARD_COOKIES: 'true'
```

## Solution

### 1. Removed JWT Authentication

Updated `src/routes/alpha/+layout.svelte` to use **cookie-based auth only**:

```typescript
// ✅ CORRECT - Cookie-based authentication only
zero = new Zero({
  server: zeroServerUrl,
  schema,
  userID: userId,
  mutators: createMutators(undefined),
  getQueriesURL: `${window.location.origin}/alpha/api/zero/get-queries`,
  mutateURL: `${window.location.origin}/alpha/api/zero/push`,
  // ⚠️ NO auth function - cookies are automatically forwarded
});
```

### 2. Fixed Environment Variable

Updated `src/lib/zero-manager.server.ts`:

```typescript
// ✅ CORRECT environment variables
ZERO_GET_QUERIES_URL: getQueriesUrl,
ZERO_GET_QUERIES_FORWARD_COOKIES: 'true', // For synced queries
ZERO_PUSH_URL: pushUrl,
ZERO_MUTATE_FORWARD_COOKIES: 'true', // For custom mutators (was ZERO_PUSH_FORWARD_COOKIES)
```

## New Architecture Flow

```
Browser (sends BetterAuth cookies)
    ↓
zero-client (WebSocket → zero-cache)
    ↓
zero-cache (forwards cookies)
    ├─→ /get-queries endpoint (reads cookies)
    └─→ /push endpoint (reads cookies)
        ↓
extractAuthData(request) reads BetterAuth session
    ↓
Permission checks in server mutators
```

## Testing

After applying these fixes and restarting the dev server:

1. **Cookies should be forwarded** in the push endpoint logs
2. **Authentication should succeed** for logged-in users
3. **Project create/edit should work** with proper permissions

## Key Takeaways

1. **Never use JWT auth** with the new Zero architecture - use cookies only
2. **Environment variable names matter** - use exact names from Zero documentation
3. **Cookie forwarding** is critical for authentication to work
4. **Restart zero-cache** after changing environment variables

## Related Files

- `src/routes/alpha/+layout.svelte` - Zero client initialization
- `src/lib/zero-manager.server.ts` - Zero-cache configuration
- `src/routes/alpha/api/zero/push/+server.ts` - Custom mutators endpoint
- `src/lib/server/auth-context.ts` - Auth extraction from cookies
- `docs/architecture/zero-synced-queries-auth.md` - Architecture documentation

