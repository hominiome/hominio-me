# Zero Permissions: Why We Have a Dummy Export

## TL;DR

**The `permissions` export in `zero-schema.ts` is a dummy that does nothing.** It exists only to satisfy `zero-cache-dev`'s automatic deployment script.

**Real security is enforced in:**
- ✅ Custom mutators (`src/lib/mutators.server.ts`) for writes
- ✅ Synced queries (`src/routes/alpha/api/zero/get-queries/+server.ts`) for reads

---

## The Problem

The `zero-cache-dev` command has a built-in feature that automatically deploys permissions. It **requires** the schema file to export a `permissions` object, or it will fail with:

```
[Zero ERROR] Schema file ./src/zero-schema.ts must export [schema] and [permissions].
```

However, we've migrated to Zero's new architecture (synced queries + custom mutators), which **doesn't use JWT-based permissions**. Instead, we use cookie-based auth with server-side permission checks.

## The Solution

We export dummy permissions that:
1. ✅ Satisfy `zero-cache-dev`'s deployment script
2. ❌ Are **NOT enforced** by the client or server
3. ✅ Allow public reads (harmless - synced queries control actual access)
4. ❌ Block all writes (also harmless - custom mutators control actual writes)

## How It Works

### 1. Legacy Systems Disabled

```typescript
export const schema = createSchema({
  tables: [...],
  enableLegacyQueries: false,    // ← Clients can't run arbitrary queries
  enableLegacyMutators: false,   // ← Clients can't use CRUD mutators
});
```

With these flags:
- **Clients can ONLY use synced queries** (not `zero.query.*`)
- **Clients can ONLY use custom mutators** (not `zero.mutate.*.insert/update/delete`)

### 2. Dummy Permissions (Not Enforced)

```typescript
export const permissions = definePermissions<DummyAuthData, typeof schema>(
  schema,
  () => ({
    project: {
      row: {
        select: ANYONE_CAN,  // ← Doesn't matter (synced queries control access)
        insert: [],          // ← Doesn't matter (custom mutators control writes)
        update: { preMutation: [], postMutation: [] },
        delete: [],
      },
    },
    // ... same for all tables
  })
);
```

These permissions are **never evaluated** because:
- Clients can't run legacy queries (disabled)
- Clients can't run legacy mutators (disabled)

### 3. Real Security (Actually Enforced)

**For Reads (Synced Queries):**

```typescript
// src/routes/alpha/api/zero/get-queries/+server.ts
export const POST: RequestHandler = async ({ request }) => {
  const authData = await extractAuthData(request); // ← BetterAuth cookie
  
  function getQuery(name: string, args: readonly ReadonlyJSONValue[]) {
    if (name === 'myProjects') {
      if (!authData?.sub) throw new Error('Unauthorized');
      return { query: builder.project.where('userId', authData.sub) };
    }
    // ... more queries with permission checks
  }
};
```

**For Writes (Custom Mutators):**

```typescript
// src/lib/mutators.server.ts
export function createServerMutators(authData: AuthData | undefined) {
  return {
    project: {
      create: async (tx, args) => {
        if (!authData?.sub) throw new Error('Unauthorized');
        
        const isFounder = await tx.query.userIdentities
          .where('userId', authData.sub)
          .where('identityType', 'founder')
          .run();
          
        if (isFounder.length === 0) {
          throw new Error('Only founders can create projects');
        }
        
        await clientMutators.project.create(tx, args);
      },
    },
  };
}
```

## Why Not Remove the Dummy Export?

We tried! But `zero-cache-dev` has no flag to skip permission deployment. The only workaround would be to use `zero-cache` directly (not `zero-cache-dev`), but that requires more manual configuration.

**This is a temporary workaround until Zero provides a way to skip permission deployment in dev mode.**

## Security Audit Checklist

- [x] `enableLegacyQueries: false` - clients can't bypass synced queries
- [x] `enableLegacyMutators: false` - clients can't bypass custom mutators
- [x] Dummy permissions allow public reads (safe - synced queries control access)
- [x] Dummy permissions block all writes (safe - custom mutators control writes)
- [x] All synced queries validate auth via `extractAuthData(request)`
- [x] All custom mutators validate permissions in `mutators.server.ts`
- [x] Cookie-based auth (BetterAuth) used throughout
- [x] No JWT tokens needed (cookie session is sufficient)

## References

- [Zero Synced Queries Docs](https://rocicorp.github.io/mono/zero/docs/synced-queries)
- [Zero Custom Mutators Docs](https://rocicorp.github.io/mono/zero/docs/custom-mutators)
- Zero Architecture Doc: `docs/architecture/zero-synced-queries-auth.md`

