# Zero Architecture: Synced Queries, Authentication & Custom Mutators

## Overview

This document explains how Zero's new architecture works in our application, specifically covering **Synced Queries**, **Cookie-Based Authentication**, and **Custom Mutators**. These three concepts work together to provide a secure, server-controlled sync system.

## Architecture Components

### 1. Synced Queries

**Synced Queries** are Zero's new read API that replaces the legacy client-side query system. Instead of clients running arbitrary queries directly against the database, clients invoke named queries that are defined on both the client and server.

#### How It Works

1. **Client-Side Query Definition** (`src/lib/synced-queries.ts`):
   ```typescript
   export const allProjects = syncedQuery(
     'allProjects',
     z.tuple([]), // No arguments
     () => {
       return builder.project.orderBy('createdAt', 'desc');
     }
   );
   ```

2. **Server-Side Query Handler** (`src/routes/alpha/api/zero/get-queries/+server.ts`):
   - Receives query requests from `zero-cache`
   - Authenticates the user using cookies (BetterAuth)
   - Returns the query definition (same as client-side or modified for permissions)

3. **Client Usage** (`src/routes/alpha/projects/+page.svelte`):
   ```typescript
   const projectsQuery = allProjects();
   const projectsView = zero.materialize(projectsQuery);
   ```

#### Benefits

- **Server-Controlled**: Server can add filters or modify queries for permissions
- **No Direct Database Access**: Clients cannot run arbitrary queries
- **Simpler Auth**: Server uses any auth system (we use BetterAuth cookies)
- **Optimistic Updates**: Queries update instantly on client, then sync to server

#### Query Flow

```
Client → zero-client → zero-cache → /get-queries endpoint → Server
                                                              ↓
Client ← zero-client ← zero-cache ← Query Definition ←──────┘
```

1. Client calls `allProjects()`
2. `zero-client` subscribes to the query, sending name + args to `zero-cache`
3. `zero-cache` calls `/get-queries` endpoint on our server
4. Server authenticates via cookies and returns query definition
5. `zero-cache` compares client query with server query and syncs results
6. Client receives data and updates UI

### 2. Cookie-Based Authentication

We use **cookie-based authentication** for Synced Queries and Custom Mutators, leveraging BetterAuth sessions.

**⚠️ CRITICAL: NO JWT - Cookies Only**

#### Configuration

**Zero Client** (`src/routes/alpha/+layout.svelte`):
```typescript
zero = new Zero({
  server: zeroServerUrl,
  schema,
  userID: userId,
  mutators: createMutators(undefined),
  getQueriesURL: `${window.location.origin}/alpha/api/zero/get-queries`,
  mutateURL: `${window.location.origin}/alpha/api/zero/push`,
  // ⚠️ NO auth function - we use cookie-based auth only
  // DO NOT add: auth: () => { ... }
});
```

**Zero-Cache** (`src/lib/zero-manager.server.ts`):
```typescript
ZERO_GET_QUERIES_URL: getQueriesUrl,
ZERO_GET_QUERIES_FORWARD_COOKIES: 'true', // Forward cookies for queries
ZERO_PUSH_URL: pushUrl,
ZERO_MUTATE_FORWARD_COOKIES: 'true', // ⚠️ Correct name for mutator cookie forwarding
```

**Server Endpoint** (`src/routes/alpha/api/zero/get-queries/+server.ts`):
```typescript
const session = await auth.api.getSession({
  headers: request.headers, // Cookies forwarded from zero-cache
});
```

#### Authentication Flow

```
Browser (BetterAuth Cookie)
    ↓
zero-client (WebSocket → zero-cache with cookies)
    ↓
zero-cache (forwards cookies via env vars)
    ├─→ /get-queries endpoint (ZERO_GET_QUERIES_FORWARD_COOKIES=true)
    └─→ /push endpoint (ZERO_MUTATE_FORWARD_COOKIES=true)
        ↓
Server endpoints read BetterAuth session from cookies
    ↓
Server authenticates and processes request
```

#### Why Cookie-Based Auth (NO JWT)?

- **Standard Web Security**: Uses standard HTTP cookies, no JWT complexity
- **Automatic**: Cookies are automatically sent by browser and forwarded by zero-cache
- **Secure**: HttpOnly cookies protect against XSS attacks
- **BetterAuth Integration**: Leverages existing BetterAuth session management
- **Simplified Architecture**: No token generation, signing, or validation needed

### 3. Custom Mutators

**Custom Mutators** are Zero's new write API that replaces the legacy CRUD mutators. They allow server-side validation, permissions, and arbitrary logic.

#### Architecture

Custom mutators have two implementations:
1. **Client Mutator**: Runs optimistically on the client for instant UI updates
2. **Server Mutator**: Runs on the server with full database access and validation

#### How It Works

1. **Client calls mutator**:
   ```typescript
   zero.mutate.project.update({ id: '123', title: 'New Title' });
   ```

2. **Client mutator runs immediately** (optimistic):
   - Updates local IndexedDB
   - UI updates instantly
   - Mutation queued for server

3. **Server receives mutation** (via `/push` endpoint):
   - Validates permissions
   - Runs server-side logic
   - Updates database
   - Returns result

4. **Client receives server result**:
   - If server succeeds: Client mutator rolled back, server result applied
   - If server fails: Client mutator rolled back, error shown

#### Benefits

- **Server Authority**: Server always wins (validates, enforces permissions)
- **Optimistic Updates**: UI feels instant
- **Arbitrary Logic**: Can do anything in server mutator (send emails, call APIs, etc.)
- **Transaction Safety**: Reads and writes are transactional

#### Example: Project Update Mutator

**Client Mutator** (`src/lib/mutators.ts` - future):
```typescript
export function createMutators(authData: AuthData | undefined) {
  return {
    project: {
      update: async (tx: Transaction<Schema>, {id, title}) => {
        // Optimistic validation
        if (title.length > 100) {
          throw new Error('Title too long');
        }
        await tx.mutate.project.update({id, title});
      },
    },
  };
}
```

**Server Mutator** (`src/routes/alpha/api/zero/push/+server.ts` - future):
```typescript
export function createMutators(authData: AuthData | undefined) {
  return {
    project: {
      update: async (tx: ServerTransaction<Schema>, {id, title}) => {
        // Check permissions
        const project = await tx.query.project.where('id', id).one();
        if (project.userId !== authData?.sub) {
          throw new Error('Unauthorized');
        }
        
        // Delegate to client mutator (or add server-only logic)
        await clientMutators.project.update(tx, {id, title});
        
        // Server-only: Send notification, update audit log, etc.
      },
    },
  };
}
```

## Current Implementation Status

### ✅ Fully Implemented & Complete

#### Synced Queries (All Tables)
- **Project Queries**: `allProjects`, `projectById`, `projectsByUser` - ✅ Complete (14 files migrated)
- **Notification Queries**: `myNotifications`, `unreadNotificationCount` - ✅ Complete
- **Identity Purchase Queries**: `allPurchases`, `purchasesByUser`, `purchasesByCup`, `purchaseById` - ✅ Complete
- **User Identity Queries**: `identitiesByUser`, `identityByUserAndCup`, `identitiesByCup` - ✅ Complete
- **Vote Queries**: `allVotes`, `votesByUser`, `votesByMatch` - ✅ Complete
- **Cup Match Queries**: `allMatches`, `matchesByCup` - ✅ Complete
- **Cup Queries**: `allCups`, `cupById` - ✅ Complete

#### Custom Mutators (Core Operations)
- **Project Mutators**: `create`, `update`, `delete` - ✅ Complete with server-side permissions
- **Notification Mutators**: `create`, `markRead`, `markAllRead`, `delete` - ✅ Complete
- **Identity Purchase Mutators**: `delete` (admin only) - ✅ Complete

#### Authentication & Authorization
- **Cookie-Based Auth**: Full integration with BetterAuth - ✅ Complete
- **Zero-Cache Configuration**: Cookie forwarding for both queries and mutations - ✅ Complete
- **Role System**: Centralized `admin`, `founder`, `default` roles - ✅ Complete
- **Permission Enforcement**: Server-side checks in all custom mutators - ✅ Complete
- **Auth Context Extractor**: Unified `extractAuthData` utility - ✅ Complete

#### Configuration & Schema
- **Legacy Systems Disabled**: 
  - `enableLegacyQueries: false` - ✅ Verified (no `zero.query.*` usage)
  - `enableLegacyMutators: false` - ✅ Verified (all use custom mutators)
  - Dummy permissions export (required by zero-cache-dev, not enforced) - ✅ Complete
- **Migration Scripts**: Clean CREATE statements - ✅ Complete

### 🎯 Intentionally Preserved (Legacy Flows)
- **Payment API**: `/api/purchase-package` - Complex Stripe integration maintained
- **Voting API**: `/api/vote-match` - Tournament mechanics maintained
- **Match Operations**: `/api/determine-match-winner`, `/api/close-match` - Game logic maintained
- **Cup Progression**: `/api/start-cup`, `/api/end-round`, `/api/start-next-round` - Tournament flow maintained

## Migration Path

### Phase 1: Foundation (✅ Complete)
- [x] Create `synced-queries.ts` with query definitions
- [x] Create `/get-queries` endpoint with cookie auth
- [x] Create `mutators.ts` and `mutators.server.ts`
- [x] Create `/push` endpoint with cookie auth
- [x] Create centralized role system (`src/lib/roles.ts`)
- [x] Create auth context extractor (`src/lib/server/auth-context.ts`)

### Phase 2: Project Migration (✅ Complete)
- [x] Migrate all project queries to synced queries (14 files)
- [x] Migrate project create to custom mutators
- [x] Migrate project update to custom mutators
- [x] Migrate project delete to custom mutators
- [x] Remove legacy API endpoints (`/api/update-project`)

### Phase 3: Schema & Configuration (✅ Complete)
- [x] Disable legacy queries (`enableLegacyQueries: false`)
- [x] Disable legacy CRUD mutators (`enableLegacyMutators: false`)
- [x] Add dummy permissions export (required by zero-cache-dev, not enforced)
- [x] Document that permissions are now handled by custom mutators

### Phase 4: Notification Migration (✅ Complete)
- [x] Migrate notification queries (`myNotifications`, `unreadNotificationCount`)
- [x] Migrate notification mutators (`create`, `markRead`, `markAllRead`, `delete`)
- [x] Remove legacy API endpoints (`/api/notifications/*`)

### Phase 5: Identity & Purchase Migration (✅ Complete)
- [x] Migrate identityPurchase queries (`allPurchases`, `purchasesByUser`, etc.)
- [x] Migrate identityPurchase mutators (`delete` - admin only)
- [x] Migrate userIdentities queries (`identitiesByUser`, `identityByUserAndCup`, etc.)
- [x] Keep `/api/purchase-package` API (complex Stripe integration)

### Phase 6: Vote Migration (✅ Complete)
- [x] Migrate vote queries (`allVotes`, `votesByUser`, `votesByMatch`)
- [x] Keep `/api/vote-match` API (complex tournament mechanics)

### Phase 7: Cup & Match Migration (✅ Complete)
- [x] Migrate cupMatch queries (`allMatches`, `matchesByCup`)
- [x] Migrate cup queries (`allCups`, `cupById`)
- [x] Keep cup/match operation APIs (complex tournament progression logic)

### Phase 8: Verification & Cleanup (✅ Complete)
- [x] Verify no `zero.query.*` usage remains (all migrated to synced queries)
- [x] Verify all `zero.mutate.*` calls use custom mutators
- [x] Verify query handler covers all synced queries
- [x] Verify push handler covers all custom mutators
- [x] Remove legacy API endpoints (kept complex flow APIs as intended)

## Key Files

- `src/lib/synced-queries.ts` - Client-side synced query definitions
- `src/routes/alpha/api/zero/get-queries/+server.ts` - Server-side query handler
- `src/routes/alpha/api/zero/push/+server.ts` - Server-side mutator handler (future)
- `src/lib/mutators.ts` - Client-side mutator definitions (future)
- `src/lib/zero-manager.server.ts` - Zero-cache configuration
- `src/routes/alpha/+layout.svelte` - Zero client initialization
- `src/zero-schema.ts` - Schema and builder export

## References

- [Zero Synced Queries Docs](https://zero.rocicorp.dev/docs/synced-queries)
- [Zero Custom Mutators Docs](https://zero.rocicorp.dev/docs/custom-mutators)
- [Zero Authentication Docs](https://zero.rocicorp.dev/docs/auth)
- [Example: hello-zero-solid](https://github.com/rocicorp/hello-zero-solid)

