# Zero Sync Architecture

## Overview

This document explains how Zero's sync architecture works in our application, covering **Synced Queries**, **Cookie-Based Authentication**, and **Custom Mutators**. These three concepts work together to provide a secure, server-controlled sync system with optimistic updates.

## Architecture Components

### 1. Synced Queries

**Synced Queries** are Zero's read API. Instead of clients running arbitrary queries directly against the database, clients invoke named queries that are defined on both the client and server.

#### Key Concepts

- **Named Queries**: Each query has a unique name (e.g., `'allProjects'`, `'myNotifications'`)
- **Server Authority**: Server controls query implementation and can add filters for permissions
- **Optimistic Updates**: Queries update instantly on client, then sync to server
- **Live Updates**: Queries automatically update when data changes

#### How It Works

**1. Client-Side Query Definition** (`src/lib/synced-queries.ts`):
```typescript
import { syncedQuery } from '@rocicorp/zero';
import { builder } from '../zero-schema';
import z from 'zod';

export const allProjects = syncedQuery(
  'allProjects',              // Unique query name
  z.tuple([]),                // Argument parser (no args in this case)
  () => {                     // Query function
    return builder.project.orderBy('createdAt', 'desc');
  }
);

// Authenticated query example
export const myNotifications = syncedQueryWithContext(
  'myNotifications',
  z.tuple([]),
  (ctx: { userID: string }) => {
    return builder.notification
      .where('userId', ctx.userID)
      .orderBy('createdAt', 'desc');
  }
);
```

**2. Server-Side Query Handler** (`src/routes/alpha/api/zero/get-queries/+server.ts`):
```typescript
import { handleGetQueriesRequest, withValidation } from '@rocicorp/zero/server';
import { allProjects, myNotifications } from '$lib/synced-queries';

// Validate all queries
const validated = Object.fromEntries(
  [allProjects, myNotifications].map(q => [q.queryName, withValidation(q)])
);

function getQuery(name: string, args: readonly ReadonlyJSONValue[]) {
  const q = validated[name];
  if (!q) throw new Error(`No such query: ${name}`);
  
  // Extract auth context from cookies
  const authData = await extractAuthData(request);
  
  // Pass context for authenticated queries
  return {
    query: q(authData ? { userID: authData.sub } : undefined, ...args),
  };
}

export const POST: RequestHandler = async ({ request }) => {
  const authData = await extractAuthData(request);
  return json(await handleGetQueriesRequest(
    (name, args) => getQuery(authData, name, args),
    schema,
    request
  ));
};
```

**3. Client Usage**:
```typescript
// In a component
const projectsQuery = allProjects();
const projectsView = zero.materialize(projectsQuery);

projectsView.addListener((projects) => {
  // React to changes
  console.log('Projects updated:', projects);
});

// Or with React/SolidJS hooks
const [projects] = useQuery(allProjects());
```

#### Query Lifecycle

```
1. Client calls synced query
   ↓
2. zero-client subscribes to query (sends name + args to zero-cache)
   ↓
3. zero-cache calls /get-queries endpoint
   ↓
4. Server authenticates via cookies and returns query definition
   ↓
5. zero-cache creates query instance on server, computes initial result
   ↓
6. Results synced to client via WebSocket
   ↓
7. Client queries update automatically
   ↓
8. Ongoing: zero-cache sends incremental updates as data changes
```

#### Benefits

- **Server-Controlled**: Server can add filters or modify queries for permissions
- **No Direct Database Access**: Clients cannot run arbitrary queries
- **Simpler Auth**: Server uses any auth system (we use BetterAuth cookies)
- **Optimistic Updates**: Queries update instantly on client, then sync to server
- **Live Sync**: Changes propagate automatically to all clients

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
  mutators: createMutators(undefined), // AuthData passed server-side only
  getQueriesURL: `${window.location.origin}/alpha/api/zero/get-queries`,
  mutateURL: `${window.location.origin}/alpha/api/zero/push`,
  // ⚠️ NO auth function - we use cookie-based auth only
  // Cookies are automatically sent by browser
});
```

**Zero-Cache** (`src/lib/zero-manager.server.ts`):
```typescript
// Environment variables for zero-cache
ZERO_GET_QUERIES_URL: getQueriesUrl,
ZERO_GET_QUERIES_FORWARD_COOKIES: 'true', // Forward cookies for synced queries
ZERO_PUSH_URL: pushUrl,
ZERO_MUTATE_FORWARD_COOKIES: 'true',      // Forward cookies for custom mutators

// Command-line flags
'--get-queries-forward-cookies',  // Explicitly enable cookie forwarding
'--push-forward-cookies',          // Explicitly enable cookie forwarding
```

**Server Endpoints**:
```typescript
// Both endpoints use the same auth extraction
const authData = await extractAuthData(request);
// Reads BetterAuth session from forwarded cookies
```

#### Authentication Flow

```
Browser (BetterAuth Cookie)
    ↓
zero-client (WebSocket → zero-cache with cookies)
    ↓
zero-cache (forwards cookies via env vars/flags)
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

**Custom Mutators** are Zero's write API. They allow server-side validation, permissions, and arbitrary logic while maintaining optimistic updates.

#### Architecture

Custom mutators have **two implementations**:

1. **Client Mutator**: Runs optimistically on the client for instant UI updates
2. **Server Mutator**: Runs on the server with full database access and validation

**Server Authority**: The server mutator always takes precedence. Client mutator results are considered speculative and are discarded when the server result is known.

#### How It Works

**1. Client calls mutator**:
```typescript
zero.mutate.project.update({ id: '123', title: 'New Title' });
```

**2. Client mutator runs immediately** (optimistic):
- Updates local IndexedDB
- UI updates instantly
- Mutation queued for server

**3. Server receives mutation** (via `/push` endpoint):
- Validates permissions
- Runs server-side logic in a transaction
- Updates database
- Returns result

**4. Client receives server result**:
- If server succeeds: Client mutator rolled back, server result applied
- If server fails: Client mutator rolled back, error shown

#### Life of a Mutation

```
1. Client calls custom mutator
   ↓
2. Client mutator runs optimistically (instant UI update)
   ↓
3. Mutation sent to zero-cache → /push endpoint
   ↓
4. Server authenticates via cookies
   ↓
5. Server mutator runs in transaction:
   - Reads current state
   - Validates permissions
   - Performs updates
   ↓
6. Changes replicated to zero-cache via logical replication
   ↓
7. zero-cache calculates query updates
   ↓
8. Updates sent to all clients via WebSocket
   ↓
9. Clients roll back optimistic updates, apply server results
   ↓
10. UI updates with authoritative server data
```

#### Transaction Safety & Race Conditions

**Key Principle**: `PushProcessor` processes mutations **sequentially** in database transactions. Within a transaction, reads see all committed changes up to that point, including changes from previous mutations in the same batch.

**How Sequential Processing Works**:
1. `PushProcessor` receives a batch of mutations
2. Each mutation runs in its own transaction
3. Transactions are processed **one at a time** (not concurrently)
4. Each transaction reads the latest committed state (including previous mutations)
5. Database transactions ensure atomicity

**Example: Appending to an Array Safely**
```typescript
// Client mutator (shared with server)
addProject: async (tx: Transaction<Schema>, {cupId, projectId}) => {
  // Read latest state within transaction
  // This read sees all committed changes, including from previous mutations
  const cup = await tx.query.cup.where('id', cupId).one();
  
  if (!cup) throw new Error('Cup not found');
  
  // Parse current array from latest state
  let selectedIds: string[] = [];
  try {
    selectedIds = cup.selectedProjectIds 
      ? JSON.parse(cup.selectedProjectIds) 
      : [];
  } catch (e) {
    selectedIds = [];
  }
  
  // Validate
  if (selectedIds.includes(projectId)) {
    throw new Error('Project already in cup');
  }
  if (selectedIds.length >= cup.size) {
    throw new Error(`Cannot add more than ${cup.size} projects`);
  }
  
  // Append (don't overwrite)
  selectedIds.push(projectId);
  
  // Update atomically within transaction
  await tx.mutate.cup.update({
    id: cupId,
    selectedProjectIds: JSON.stringify(selectedIds),
    updatedAt: new Date().toISOString(),
  });
}
```

**Why This Works**:
- `PushProcessor.process()` executes mutations sequentially, not concurrently
- Each mutation runs in its own database transaction
- Transactions are processed one at a time, so each sees the result of the previous
- Database transactions ensure atomicity (all-or-nothing)
- Server result overwrites optimistic client result
- If mutations conflict, the last one wins (which is correct for sequential processing)

**Important**: Read **once** within the transaction, right before updating. Don't read multiple times or cache the read value, as you need the absolute latest state.

#### Example: Project Update Mutator

**Client Mutator** (`src/lib/mutators.ts`):
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

**Server Mutator** (`src/lib/mutators.server.ts`):
```typescript
export function createServerMutators(
  authData: AuthData | undefined,
  clientMutators: any
) {
  return {
    project: {
      update: async (tx: AnyTransaction, {id, title}) => {
        // Check permissions
        const project = await tx.query.project.where('id', id).one();
        if (project.userId !== authData?.sub && !authData?.isAdmin) {
          throw new Error('Unauthorized');
        }
        
        // Delegate to client mutator (shared logic)
        await clientMutators.project.update(tx, {id, title});
        
        // Server-only: Send notification, update audit log, etc.
      },
    },
  };
}
```

**Push Endpoint** (`src/routes/alpha/api/zero/push/+server.ts`):
```typescript
import { PushProcessor } from '@rocicorp/zero/server';
import { zeroNodePg } from '@rocicorp/zero/server/adapters/pg';

const processor = new PushProcessor(zeroNodePg(schema, pool));

export const POST: RequestHandler = async ({ request }) => {
  const authData = await extractAuthData(request);
  const clientMutators = createMutators(authData);
  const serverMutators = createServerMutators(authData, clientMutators);
  
  // PushProcessor handles push protocol, executes mutators sequentially in transactions
  const result = await processor.process(serverMutators, request);
  return json(result);
};
```

#### Benefits

- **Server Authority**: Server always wins (validates, enforces permissions)
- **Optimistic Updates**: UI feels instant
- **Transaction Safety**: Reads and writes are transactional
- **Arbitrary Logic**: Can do anything in server mutator (send emails, call APIs, etc.)
- **Code Sharing**: Client and server mutators can share logic (both use ZQL)

#### Waiting for Mutator Results

**Fire and Forget** (recommended):
```typescript
zero.mutate.project.update({ id: '123', title: 'New Title' });
// UI updates instantly, error handling happens automatically
```

**Wait for Client Write**:
```typescript
const write = zero.mutate.project.update({ id: '123', title: 'New Title' });
await write.client; // Wait for local write to complete
```

**Wait for Server Write**:
```typescript
const write = zero.mutate.project.update({ id: '123', title: 'New Title' });
await write.server; // Wait for server confirmation (includes client write)
```

## Implementation Details

### Synced Queries Implementation

**All tables migrated to synced queries**:
- **Project Queries**: `allProjects`, `projectById`, `projectsByUser`
- **Notification Queries**: `myNotifications`, `unreadNotificationCount`
- **Identity Purchase Queries**: `allPurchases`, `purchasesByUser`, `purchasesByCup`, `purchaseById`
- **User Identity Queries**: `identitiesByUser`, `identityByUserAndCup`, `identitiesByCup`
- **Vote Queries**: `allVotes`, `votesByUser`, `votesByMatch`
- **Cup Match Queries**: `allMatches`, `matchesByCup`
- **Cup Queries**: `allCups`, `cupById`

**Query Handler Pattern**:
```typescript
// Server validates and returns query definitions
const validated = Object.fromEntries(
  [allProjects, myNotifications, ...].map(q => [q.queryName, withValidation(q)])
);

function getQuery(authData: AuthData | undefined, name: string, args: readonly ReadonlyJSONValue[]) {
  const q = validated[name];
  if (!q) throw new Error(`No such query: ${name}`);
  
  // Pass context for authenticated queries, undefined for public queries
  return {
    query: q(authData ? { userID: authData.sub } : undefined, ...args),
  };
}
```

### Custom Mutators Implementation

**Mutators Available**:
- **Project Mutators**: `create`, `update`, `delete` (with server-side permissions)
- **Notification Mutators**: `create`, `markRead`, `markAllRead`, `delete`
- **Identity Purchase Mutators**: `delete` (admin only)
- **Cup Mutators**: `create`, `update`, `addProject`, `removeProject` (admin only)

**Server Mutator Pattern**:
```typescript
// Server mutators wrap client mutators with permission checks
export function createServerMutators(
  authData: AuthData | undefined,
  clientMutators: any
) {
  return {
    cup: {
      addProject: async (tx: AnyTransaction, args) => {
        // Check permissions
        if (!authData?.sub) throw new Error('Unauthorized');
        if (!isAdmin(authData.sub)) throw new Error('Forbidden');
        
        // Delegate to client mutator (shared logic)
        await clientMutators.cup.addProject(tx, args);
      },
    },
  };
}
```

**Push Endpoint Pattern**:
```typescript
const processor = new PushProcessor(zeroNodePg(schema, pool));

export const POST: RequestHandler = async ({ request }) => {
  const authData = await extractAuthData(request);
  const clientMutators = createMutators(authData);
  const serverMutators = createServerMutators(authData, clientMutators);
  
  // PushProcessor processes mutations sequentially in transactions
  const result = await processor.process(serverMutators, request);
  return json(result);
};
```

### Authentication & Authorization

- **Cookie-Based Auth**: Full integration with BetterAuth
- **Zero-Cache Configuration**: Cookie forwarding via `ZERO_GET_QUERIES_FORWARD_COOKIES` and `ZERO_MUTATE_FORWARD_COOKIES`
- **Role System**: Centralized `admin`, `founder`, `default` roles via `src/lib/roles.ts`
- **Permission Enforcement**: Server-side checks in all custom mutators
- **Auth Context Extractor**: Unified `extractAuthData` utility in `src/lib/server/auth-context.ts`

### Configuration

- **Legacy Systems Disabled**: 
  - `enableLegacyQueries: false` - No `zero.query.*` usage
  - `enableLegacyMutators: false` - All use custom mutators
- **Dummy Permissions**: Required by zero-cache-dev, not enforced (security via mutators)

### Intentionally Preserved (Complex Flows)

These APIs remain as legacy endpoints due to complex business logic:
- **Payment API**: `/api/purchase-package` - Complex Stripe integration
- **Voting API**: `/api/vote-match` - Tournament mechanics
- **Match Operations**: `/api/determine-match-winner`, `/api/end-round` - Game logic
- **Cup Progression**: `/api/start-cup`, `/api/start-next-round` - Tournament flow

## Key Files

- `src/lib/synced-queries.ts` - Client-side synced query definitions
- `src/routes/alpha/api/zero/get-queries/+server.ts` - Server-side query handler
- `src/routes/alpha/api/zero/push/+server.ts` - Server-side mutator handler
- `src/lib/mutators.ts` - Client-side mutator definitions
- `src/lib/mutators.server.ts` - Server-side mutator definitions with permissions
- `src/lib/zero-manager.server.ts` - Zero-cache configuration
- `src/routes/alpha/+layout.svelte` - Zero client initialization
- `src/zero-schema.ts` - Schema and builder export
- `src/lib/server/auth-context.ts` - Auth data extraction utility

## References

- [Zero Synced Queries Docs](https://zero.rocicorp.dev/docs/synced-queries)
- [Zero Custom Mutators Docs](https://zero.rocicorp.dev/docs/custom-mutators)
- [Zero Authentication Docs](https://zero.rocicorp.dev/docs/auth)

