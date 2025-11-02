# Zero Architecture Refactor: DRY Abstraction Plan

## Executive Summary

This document outlines a comprehensive plan to refactor the entire codebase to the new Zero custom mutators and synced queries architecture, with a focus on creating reusable, DRY (Don't Repeat Yourself) abstractions.

**Current State:**
- 51 legacy query usages across 15 files
- 11 legacy mutate usages across 5 files
- Duplicated auth, validation, and Zero initialization patterns
- Mixed architecture (legacy + new)

**Goal:**
- 100% migration to synced queries and custom mutators
- Universal, reusable abstractions for all common patterns
- Remove ALL legacy code once tested (no deprecation notices)
- Single source of truth for each concern

---

## Current System Analysis

### 1. **Duplicated Patterns Identified**

#### Pattern A: Zero Initialization & Access
**Current duplication count:** ~15 components
**Location:** Every component that uses Zero

```typescript
// REPEATED in every component:
const zeroContext = getContext("zero");
let zero = null;

onMount(() => {
  const checkZero = setInterval(() => {
    if (zeroContext.isReady() && zeroContext.getInstance()) {
      clearInterval(checkZero);
      zero = zeroContext.getInstance();
      // ... setup queries
    }
  }, 100);
  
  return () => {
    clearInterval(checkZero);
    if (view) view.destroy();
  };
});
```

#### Pattern B: Authentication Extraction
**Current duplication count:** 2 server endpoints (will be N endpoints)
**Location:** `/get-queries/+server.ts`, `/push/+server.ts`

```typescript
// REPEATED in both endpoints:
const session = await auth.api.getSession({
  headers: request.headers,
});

const authData = session?.user
  ? {
      sub: session.user.id,
      isAdmin: false,
    }
  : undefined;
```

#### Pattern C: Query Materialization & Listeners
**Current duplication count:** ~30 locations
**Location:** Every component that materializes queries

```typescript
// REPEATED everywhere:
const query = zero.query.table.where(...);
const view = query.materialize();

view.addListener((data) => {
  const items = Array.from(data);
  // ... update state
});

// Cleanup
return () => {
  if (view) view.destroy();
};
```

#### Pattern D: Permission Checks
**Current duplication count:** ~20 locations
**Location:** Every server mutator, many components

```typescript
// REPEATED in every mutator:
if (!authData?.sub) {
  throw new Error('Unauthorized');
}

const userIsAdmin = isAdmin(authData.sub);
if (!userIsAdmin) {
  throw new Error('Forbidden');
}
```

#### Pattern E: Form Validation & Submission
**Current duplication count:** ~8 forms
**Location:** Create/edit forms for projects, cups, etc.

```typescript
// REPEATED in every form:
const canSubmit = $derived(
  field1.trim() &&
  field2.trim() &&
  field3 &&
  !saving
);

async function submit() {
  if (!canSubmit) return;
  saving = true;
  
  try {
    // Trim all strings
    const data = {
      field1: field1.trim(),
      field2: field2.trim(),
      // ...
    };
    
    await mutate(data);
    // Reset form
    // Close modal
  } catch (error) {
    showError(error.message);
  } finally {
    saving = false;
  }
}
```

#### Pattern F: Synced Query Server Handlers
**Current duplication count:** 1 (will grow to N)
**Location:** `/get-queries/+server.ts`

```typescript
// Will be repeated for every query:
function getQuery(name: string, args: readonly ReadonlyJSONValue[]) {
  if (name === 'queryName') {
    z.tuple([...]).parse(args);
    return { query: builder.table... };
  }
  // ... more queries
}
```

#### Pattern G: Custom Mutator Server Handlers
**Current duplication count:** 1 (will grow to N)
**Location:** `/push/+server.ts` + individual mutator functions

```typescript
// Will be repeated for every mutator:
export function createServerMutators(authData, clientMutators) {
  return {
    table: {
      action: async (tx, args) => {
        if (!authData?.sub) throw new Error('Unauthorized');
        
        // Check permissions
        const canAct = await checkPermission(tx, authData);
        if (!canAct) throw new Error('Forbidden');
        
        // Delegate to client mutator
        await clientMutators.table.action(tx, args);
      },
    },
  };
}
```

---

## Proposed Abstractions (DRY Solutions)

### 🎯 **Abstraction 1: Universal Zero Hook**

**File:** `src/lib/hooks/useZeroQuery.svelte.ts`

**Purpose:** Replace ALL manual Zero initialization and query materialization

**Features:**
- Auto-initialize Zero (wait for ready)
- Auto-create query/view
- Auto-setup listener with reactive state
- Auto-cleanup on unmount
- Error handling
- Loading states
- TypeScript generic support

**Usage Example:**
```typescript
// BEFORE (15 lines of boilerplate):
const zeroContext = getContext("zero");
let zero = null;
let projects = $state([]);
let loading = $state(true);
// ... polling, listener, cleanup

// AFTER (1 line):
const { data: projects, loading, error } = useZeroQuery(
  (zero) => zero.query.project.where(...),
  { deps: [$session] } // Optional reactive deps
);
```

**Implementation Strategy:**
```typescript
export function useZeroQuery<T>(
  queryFn: (zero: Zero) => Query,
  options?: {
    deps?: any[]; // Reactive dependencies
    transform?: (data: any[]) => T[]; // Transform function
    enabled?: boolean; // Conditional execution
  }
) {
  // Internal: Auto-wait for Zero
  // Internal: Auto-materialize query
  // Internal: Auto-setup listener
  // Internal: Auto-cleanup
  // Return: reactive state
}
```

---

### 🎯 **Abstraction 2: Synced Query Registry**

**File:** `src/lib/synced-queries-registry.ts`

**Purpose:** Single source of truth for ALL synced queries (client + server)

**Features:**
- Register queries once
- Auto-generate client-side synced queries
- Auto-generate server-side handlers
- Type-safe args validation (Zod)
- Permission decorators

**Usage Example:**
```typescript
// Define once:
export const queries = createQueryRegistry({
  allProjects: {
    args: z.tuple([]),
    query: () => builder.project.orderBy('createdAt', 'desc'),
    permissions: 'public', // or check function
  },
  
  projectById: {
    args: z.tuple([z.string()]),
    query: (id: string) => builder.project.where('id', id),
    permissions: 'public',
  },
  
  myProjects: {
    args: z.tuple([]),
    query: () => builder.project.where('userId', '=', '{{userId}}'), // Template
    permissions: 'authenticated',
  },
});

// Client-side: Auto-generated hooks
const projects = queries.allProjects.use();
const project = queries.projectById.use(projectId);

// Server-side: Single handler
export const POST = createQueryHandler(queries);
```

**Benefits:**
- No duplication between client/server
- Type-safe query args
- Auto-validates permissions
- Single file to manage all queries

---

### 🎯 **Abstraction 3: Mutator Factory**

**File:** `src/lib/mutators-factory.ts`

**Purpose:** Generate client + server mutators from single definition

**Features:**
- Define mutator logic once
- Auto-generate client mutator (with validation)
- Auto-generate server mutator (with permissions)
- Permission decorators (admin, owner, founder, custom)
- Built-in string trimming, validation

**Usage Example:**
```typescript
export const mutators = createMutatorFactory({
  project: {
    update: {
      // Args schema (Zod)
      args: z.object({
        id: z.string(),
        title: z.string().min(1).max(100),
        description: z.string().min(1),
        // ...
      }),
      
      // Client logic (runs optimistically)
      client: async (tx, args) => {
        const { id, ...updates } = args;
        await tx.mutate.project.update({ id, ...updates });
      },
      
      // Permission check (runs server-side)
      permissions: async (tx, args, authData) => {
        // Built-in helpers:
        return await canUpdateProject(tx, args.id, authData.sub);
        // Or inline:
        // return authData.isAdmin || (await isOwner(tx, args.id, authData.sub));
      },
      
      // Server-only logic (optional)
      server: async (tx, args, authData) => {
        // Send notifications, update analytics, etc.
      },
    },
  },
});

// Client usage:
await zero.mutate.project.update({ id, title, ... });

// Server: Auto-generated handlers
export const POST = createMutatorHandler(mutators);
```

**Benefits:**
- Single source of truth for each mutator
- Auto-validates args (Zod)
- Auto-handles permissions
- Auto-generates client + server code
- Built-in error handling

---

### 🎯 **Abstraction 4: Auth Context Extractor**

**File:** `src/lib/server/auth-context.ts`

**Purpose:** Extract auth data consistently across all endpoints

**Features:**
- Single function to extract auth from cookies
- Returns typed AuthData
- Checks admin status automatically
- Caches session for request lifecycle

**Usage Example:**
```typescript
// BEFORE (repeated in every endpoint):
const session = await auth.api.getSession({ headers: request.headers });
const authData = session?.user ? { sub: session.user.id, isAdmin: false } : undefined;
const userIsAdmin = isAdmin(authData.sub);

// AFTER (1 line):
const authData = await extractAuthData(request);
// Returns: { sub: string, isAdmin: boolean } | undefined
```

**Implementation:**
```typescript
export async function extractAuthData(request: Request): Promise<AuthData | undefined> {
  const session = await auth.api.getSession({ headers: request.headers });
  
  if (!session?.user) return undefined;
  
  return {
    sub: session.user.id,
    isAdmin: isAdmin(session.user.id),
  };
}
```

---

### 🎯 **Abstraction 5: Form State Manager**

**File:** `src/lib/hooks/useFormState.svelte.ts`

**Purpose:** Universal form validation, submission, and state management

**Features:**
- Auto-trim strings
- Auto-validate required fields
- Auto-handle loading/error states
- Reset function
- Submit function with error handling
- Reactive validation derived state

**Usage Example:**
```typescript
// BEFORE (30+ lines per form):
let title = $state('');
let description = $state('');
let saving = $state(false);
const canSubmit = $derived(title.trim() && description.trim() && !saving);
async function submit() { /* ... */ }

// AFTER (5 lines):
const form = useFormState({
  title: { value: '', required: true, maxLength: 100 },
  description: { value: '', required: true },
  country: { value: null, required: true },
  sdgs: { value: [], required: true, minLength: 1 },
});

// Auto-generated:
// - form.values (reactive)
// - form.canSubmit (derived validation)
// - form.submit(mutatorFn)
// - form.reset()
// - form.saving, form.error
```

**Benefits:**
- No boilerplate for form state
- Consistent validation across all forms
- Built-in string trimming
- Built-in error handling
- One-line submit

---

### 🎯 **Abstraction 6: Permission Helpers Library**

**File:** `src/lib/permissions/index.ts`

**Purpose:** Centralized, composable permission checks

**Features:**
- Predefined helpers (isAdmin, isOwner, isFounder, etc.)
- Composable (AND, OR, NOT)
- Works with both ServerTransaction and Transaction
- Type-safe

**Usage Example:**
```typescript
// BEFORE (repeated everywhere):
const userIsAdmin = isAdmin(authData.sub);
const project = await tx.query.project.where('id', id).one();
const isOwner = project.userId === authData.sub;
const hasFounder = await hasFounderIdentity(tx, authData.sub);

// AFTER (composable):
import { check, isAdmin, isOwner, hasFounder, or, and } from '$lib/permissions';

const canUpdate = await check(
  or(
    isAdmin,
    and(isOwner('project', projectId), hasFounder)
  ),
  { tx, authData }
);
```

**Implementation:**
```typescript
export const isAdmin = (authData: AuthData) => isAdminCheck(authData.sub);

export const isOwner = (table: string, id: string) => async (
  tx: Transaction | ServerTransaction,
  authData: AuthData
) => {
  const record = await tx.query[table].where('id', id).one();
  return record?.userId === authData.sub;
};

export const or = (...checks) => async (tx, authData) => {
  for (const check of checks) {
    if (await check(tx, authData)) return true;
  }
  return false;
};
```

---

### 🎯 **Abstraction 7: Zero Context Provider (Enhanced)**

**File:** `src/lib/context/zero-provider.svelte.ts`

**Purpose:** Enhanced Zero context with built-in hooks

**Features:**
- Provide Zero instance + utilities
- Provide auth state
- Provide permission state (isAdmin, hasFounder, etc.)
- Auto-refresh on session change

**Usage Example:**
```typescript
// In layout (provide):
<ZeroProvider {session}>
  {@render children()}
</ZeroProvider>

// In components (consume):
const { zero, isReady, authData, isAdmin, hasFounder } = useZeroContext();

// Or specific hooks:
const projects = useZeroQuery((z) => z.query.project...);
const isAdmin = useIsAdmin();
const hasFounder = useHasFounder();
```

---

## Migration Strategy

### Phase 1: Create Abstractions (Week 1)
**Goal:** Build all DRY abstractions without breaking existing code

**Tasks:**
1. ✅ Create `useZeroQuery` hook
2. ✅ Create query registry system
3. ✅ Create mutator factory
4. ✅ Create auth context extractor
5. ✅ Create form state manager
6. ✅ Create permission helpers
7. ✅ Write unit tests for all abstractions

**Testing:**
- Test each abstraction in isolation
- Create example components using new system
- Verify backward compatibility

---

### Phase 2: Migrate Queries (Week 2)
**Goal:** Migrate all 51 legacy queries to synced queries

**Priority Order:**
1. **High-traffic pages** (projects list, cup details) - 5 files
2. **Admin pages** (project edit, cup admin) - 4 files
3. **User pages** (me, profile) - 3 files
4. **Remaining pages** - 3 files

**Per-File Process:**
1. Define synced query in registry
2. Replace legacy query with `useZeroQuery` hook
3. Remove manual Zero initialization boilerplate
4. Test page functionality
5. Commit + verify no regressions

**Tracking:**
- Create checklist for all 15 files
- Mark completed as we go
- Run integration tests after each file

---

### Phase 3: Migrate Mutators (Week 3)
**Goal:** Migrate all 11 legacy mutates to custom mutators

**Priority Order:**
1. **Project mutations** (create, update) - 3 files
2. **Cup mutations** (create, update) - 2 files
3. **Vote mutations** - 1 file
4. **Identity mutations** - 1 file
5. **Notification mutations** - 1 file

**Per-Mutator Process:**
1. Define mutator in factory
2. Replace legacy mutate with new custom mutator
3. Remove old API endpoint (if exists)
4. Test mutation with permissions
5. Commit + verify

---

### Phase 4: Clean Up Legacy Code (Week 4)
**Goal:** Remove ALL legacy code (no deprecation notices)

**Tasks:**
1. ❌ Remove all legacy query code paths
2. ❌ Remove all legacy mutator code paths
3. ❌ Remove old API endpoints (`/alpha/api/update-project`, etc.)
4. ❌ Remove legacy permissions from `zero-schema.ts`
5. ❌ Remove JWT auth (keep only cookie-based)
6. ❌ Set `enableLegacyQueries: false` in Zero config
7. ❌ Set `enableLegacyMutators: false` in Zero config
8. ❌ Run full regression test suite
9. ❌ Deploy to staging and test thoroughly
10. ❌ Deploy to production

**Verification:**
- Grep for `zero.query.` - should return 0 results (except in abstractions)
- Grep for `zero.mutate.` - should return 0 results (except in abstractions)
- Grep for `/alpha/api/update-` - should return 0 results
- All tests passing
- Manual QA of critical flows

---

## File Structure (New)

```
src/
├── lib/
│   ├── hooks/
│   │   ├── useZeroQuery.svelte.ts       # Universal Zero query hook
│   │   ├── useZeroMutation.svelte.ts    # Universal Zero mutation hook
│   │   ├── useFormState.svelte.ts       # Universal form state manager
│   │   └── useAuth.svelte.ts            # Auth state hook
│   │
│   ├── synced-queries/
│   │   ├── registry.ts                  # Query registry (single source of truth)
│   │   ├── projects.ts                  # Project queries
│   │   ├── cups.ts                      # Cup queries
│   │   ├── votes.ts                     # Vote queries
│   │   └── notifications.ts             # Notification queries
│   │
│   ├── mutators/
│   │   ├── factory.ts                   # Mutator factory
│   │   ├── projects.ts                  # Project mutators
│   │   ├── cups.ts                      # Cup mutators
│   │   ├── votes.ts                     # Vote mutators
│   │   └── identities.ts                # Identity mutators
│   │
│   ├── permissions/
│   │   ├── index.ts                     # Permission helpers (isAdmin, isOwner, etc.)
│   │   ├── composable.ts                # Composable helpers (or, and, not)
│   │   └── checks.ts                    # Specific permission checks
│   │
│   ├── server/
│   │   ├── auth-context.ts              # Auth data extractor
│   │   ├── query-handler.ts             # Universal query handler
│   │   └── mutator-handler.ts           # Universal mutator handler
│   │
│   └── context/
│       └── zero-provider.svelte         # Enhanced Zero context provider
│
├── routes/
│   └── alpha/
│       └── api/
│           └── zero/
│               ├── get-queries/+server.ts   # Uses query registry
│               └── push/+server.ts          # Uses mutator factory
│
└── docs/
    └── architecture/
        ├── zero-refactor-abstraction-plan.md     # This file
        └── zero-synced-queries-auth.md           # Updated with final state
```

---

## Benefits Summary

### Before Refactor:
- 51 legacy queries with manual boilerplate (15+ lines each) = **~765 lines**
- 11 legacy mutates with manual error handling (20+ lines each) = **~220 lines**
- Duplicated auth extraction in 2 endpoints (will grow) = **~50 lines**
- Duplicated form validation in 8 forms (30+ lines each) = **~240 lines**
- **Total: ~1,275 lines of boilerplate**

### After Refactor:
- Query definitions in registry = **~200 lines**
- Mutator definitions in factory = **~300 lines**
- Hook usage (1 line per query) = **~51 lines**
- Form usage (5 lines per form) = **~40 lines**
- **Total: ~591 lines**

### Net Savings:
- **~684 lines removed** (53% reduction)
- **Single source of truth** for all queries and mutators
- **Type-safe** throughout
- **Consistent** patterns everywhere
- **Easier to maintain** and extend

---

## Success Criteria

### Week 1 (Abstractions)
- ✅ All 7 abstraction modules created
- ✅ Unit tests passing
- ✅ Example components working

### Week 2 (Queries)
- ✅ 51 legacy queries migrated to synced queries
- ✅ All 15 files updated
- ✅ Integration tests passing

### Week 3 (Mutators)
- ✅ 11 legacy mutates migrated to custom mutators
- ✅ All 5 files updated
- ✅ Old API endpoints removed

### Week 4 (Cleanup)
- ✅ Zero legacy code remaining
- ✅ `enableLegacyQueries: false`
- ✅ `enableLegacyMutators: false`
- ✅ Full regression test suite passing
- ✅ Production deployment successful

---

## Risk Mitigation

### Risk 1: Breaking Changes During Migration
**Mitigation:**
- Migrate one file at a time
- Keep existing code until new code is tested
- Feature flags for gradual rollout
- Comprehensive test coverage before each merge

### Risk 2: Performance Regressions
**Mitigation:**
- Profile before/after each migration
- Monitor query performance in production
- Optimize hot paths first
- Cache expensive permission checks

### Risk 3: Auth/Permission Bugs
**Mitigation:**
- Extensive permission testing
- Security review of all mutators
- Test with different user roles
- Penetration testing before cleanup phase

### Risk 4: Timeline Overrun
**Mitigation:**
- Clear daily goals
- Prioritize high-impact files first
- Pair programming for complex migrations
- Regular standups to unblock issues

---

## Next Steps

1. **Review this plan** with the team
2. **Create GitHub issues** for each phase
3. **Set up tracking board** (Kanban)
4. **Begin Phase 1** (Create abstractions)
5. **Daily commits** with clear messages
6. **Weekly demos** of progress

---

## Questions to Answer Before Starting

1. ✅ Should we use a feature flag system for gradual rollout?
2. ✅ Do we need to coordinate with backend team on any changes?
3. ✅ What's our rollback strategy if we find critical bugs?
4. ✅ Should we do a code freeze during cleanup phase?
5. ✅ How do we ensure no one commits legacy code during migration?

---

**Document Version:** 1.0  
**Last Updated:** 2025-11-02  
**Status:** Ready for Review  
**Next Review Date:** After Phase 1 Completion

