# Zero Refactor: Quick Reference Guide

## 🎯 7 Key Abstractions (DRY Solutions)

### 1️⃣ useZeroQuery Hook
**Replaces:** Manual Zero initialization + query boilerplate  
**Saves:** 15 lines → 1 line per query

```typescript
// ❌ BEFORE (15 lines):
const zeroContext = getContext("zero");
let zero = null;
let projects = $state([]);
let loading = $state(true);
onMount(() => {
  const checkZero = setInterval(() => {
    if (zeroContext.isReady()) {
      zero = zeroContext.getInstance();
      const query = zero.query.project.orderBy('createdAt', 'desc');
      const view = query.materialize();
      view.addListener((data) => {
        projects = Array.from(data);
        loading = false;
      });
    }
  }, 100);
  return () => clearInterval(checkZero);
});

// ✅ AFTER (1 line):
const { data: projects, loading } = useZeroQuery(
  (zero) => zero.query.project.orderBy('createdAt', 'desc')
);
```

---

### 2️⃣ Query Registry
**Replaces:** Separate client/server query definitions  
**Saves:** Eliminates duplication, single source of truth

```typescript
// ❌ BEFORE: Define queries in 2 places
// Client: src/lib/synced-queries.ts
export const allProjects = syncedQuery('allProjects', z.tuple([]), () => {
  return builder.project.orderBy('createdAt', 'desc');
});

// Server: src/routes/alpha/api/zero/get-queries/+server.ts
function getQuery(name: string, args) {
  if (name === 'allProjects') {
    z.tuple([]).parse(args);
    return { query: builder.project.orderBy('createdAt', 'desc') };
  }
}

// ✅ AFTER: Define once
export const queries = createQueryRegistry({
  allProjects: {
    args: z.tuple([]),
    query: () => builder.project.orderBy('createdAt', 'desc'),
    permissions: 'public',
  },
});

// Client: queries.allProjects.use()
// Server: createQueryHandler(queries)
```

---

### 3️⃣ Mutator Factory
**Replaces:** Separate client/server mutator definitions  
**Saves:** Single definition for both client + server

```typescript
// ❌ BEFORE: Define mutators in 2 places
// Client: src/lib/mutators.ts (30 lines)
// Server: src/lib/mutators.server.ts (40 lines)

// ✅ AFTER: Define once (auto-generates both)
export const mutators = createMutatorFactory({
  project: {
    update: {
      args: z.object({
        id: z.string(),
        title: z.string().min(1),
        description: z.string(),
      }),
      client: async (tx, { id, title, description }) => {
        await tx.mutate.project.update({ id, title, description });
      },
      permissions: async (tx, args, authData) => {
        return await canUpdateProject(tx, args.id, authData.sub);
      },
    },
  },
});

// Usage: await zero.mutate.project.update({ id, title, description });
```

---

### 4️⃣ Auth Context Extractor
**Replaces:** Manual auth extraction in every endpoint  
**Saves:** 10 lines → 1 line per endpoint

```typescript
// ❌ BEFORE (10 lines):
const session = await auth.api.getSession({ headers: request.headers });
const authData = session?.user
  ? {
      sub: session.user.id,
      isAdmin: false,
    }
  : undefined;
const userIsAdmin = isAdmin(authData?.sub);

// ✅ AFTER (1 line):
const authData = await extractAuthData(request);
// Returns: { sub: string, isAdmin: boolean } | undefined
```

---

### 5️⃣ Form State Manager
**Replaces:** Manual form state, validation, submit logic  
**Saves:** 30 lines → 5 lines per form

```typescript
// ❌ BEFORE (30+ lines):
let title = $state('');
let description = $state('');
let saving = $state(false);
let error = $state(null);

const canSubmit = $derived(
  title.trim() && description.trim() && !saving
);

async function submit() {
  if (!canSubmit) return;
  saving = true;
  try {
    await mutate({
      title: title.trim(),
      description: description.trim(),
    });
    title = '';
    description = '';
  } catch (e) {
    error = e.message;
  } finally {
    saving = false;
  }
}

// ✅ AFTER (5 lines):
const form = useFormState({
  title: { value: '', required: true },
  description: { value: '', required: true },
});

// Auto-generated: form.values, form.canSubmit, form.submit(), form.reset()
```

---

### 6️⃣ Permission Helpers
**Replaces:** Repeated permission check logic  
**Saves:** Composable, reusable permission checks

```typescript
// ❌ BEFORE (10+ lines):
const userIsAdmin = isAdmin(authData.sub);
const project = await tx.query.project.where('id', projectId).one();
const isOwner = project?.userId === authData.sub;
const hasFounder = await hasFounderIdentity(tx, authData.sub);
const canUpdate = userIsAdmin || (isOwner && hasFounder);

// ✅ AFTER (2 lines):
const canUpdate = await check(
  or(isAdmin, and(isOwner('project', projectId), hasFounder)),
  { tx, authData }
);
```

---

### 7️⃣ Zero Context Provider (Enhanced)
**Replaces:** Manual context setup + auth state management  
**Saves:** Centralized Zero + auth state

```typescript
// ❌ BEFORE:
// Every component manually gets Zero context
// Every component manually checks isAdmin, hasFounder, etc.

// ✅ AFTER:
// Layout provides everything:
<ZeroProvider {session}>
  {@render children()}
</ZeroProvider>

// Components consume:
const { zero, isReady, authData, isAdmin, hasFounder } = useZeroContext();

// Or use specific hooks:
const projects = useZeroQuery(...);
const isAdmin = useIsAdmin();
const hasFounder = useHasFounder();
```

---

## 📊 Impact Summary

| Abstraction | Files Affected | Lines Saved | Benefit |
|------------|---------------|-------------|---------|
| useZeroQuery | 15 files | ~680 lines | Auto-init, auto-cleanup |
| Query Registry | 1 registry | ~200 lines | Single source of truth |
| Mutator Factory | 5 tables | ~300 lines | Auto-generates client+server |
| Auth Extractor | 2+ endpoints | ~20 lines | Consistent auth everywhere |
| Form Manager | 8 forms | ~200 lines | No boilerplate, consistent UX |
| Permission Helpers | 20+ checks | ~150 lines | Composable, reusable |
| Context Provider | All components | ~100 lines | Centralized state |
| **TOTAL** | **~50 files** | **~1,650 lines** | **53% reduction** |

---

## 🔄 Migration Order

1. **Week 1: Create Abstractions**
   - Build all 7 abstractions
   - Write tests
   - Create examples

2. **Week 2: Migrate Queries**
   - 51 legacy queries → synced queries
   - 15 files updated

3. **Week 3: Migrate Mutators**
   - 11 legacy mutates → custom mutators
   - 5 files updated

4. **Week 4: Clean Up**
   - Remove ALL legacy code
   - Set `enableLegacyQueries: false`
   - Set `enableLegacyMutators: false`
   - Deploy

---

## ✅ Testing Strategy

### Per Abstraction:
- ✅ Unit tests
- ✅ Integration tests
- ✅ Example component

### Per Migration:
- ✅ Functionality unchanged
- ✅ Permissions enforced
- ✅ Error handling works
- ✅ Performance maintained

### Before Cleanup:
- ✅ Full regression suite
- ✅ Security audit
- ✅ Load testing
- ✅ Staging deployment

---

## 🚀 Quick Start (When Ready)

### Step 1: Create useZeroQuery
```bash
# Create the hook
touch src/lib/hooks/useZeroQuery.svelte.ts

# Implement with:
# - Auto wait for Zero ready
# - Auto materialize query
# - Auto setup listener
# - Auto cleanup
```

### Step 2: Migrate First Component
```typescript
// Pick high-impact page (e.g., projects list)
// Replace legacy query with useZeroQuery
// Test thoroughly
// Commit
```

### Step 3: Repeat for All 15 Files
```bash
# Track progress:
- [ ] projects/+page.svelte
- [ ] cups/[cupId]/+page.svelte
- [ ] me/+page.svelte
# ... (15 total)
```

### Step 4: Build Query Registry
```bash
# After all queries migrated
# Extract common patterns into registry
# Auto-generate client/server handlers
```

### Step 5: Migrate Mutators
```bash
# Same process as queries
# Start with project.update (already done)
# Then project.create, cup.update, etc.
```

### Step 6: Clean Up
```bash
# Remove all legacy code
# grep -r "zero.query." src/  # Should return 0
# grep -r "zero.mutate." src/ # Should return 0
# Deploy!
```

---

## 📝 Daily Checklist

**Morning:**
- [ ] Review plan for today
- [ ] Set clear goal (e.g., "Migrate 3 query files")
- [ ] Check dependencies

**During Work:**
- [ ] One file at a time
- [ ] Test before commit
- [ ] Clear commit messages
- [ ] Update progress tracker

**Evening:**
- [ ] Run full test suite
- [ ] Demo progress
- [ ] Plan tomorrow
- [ ] Update this document

---

## 🆘 Troubleshooting

### Issue: Zero not ready in time
**Solution:** Increase timeout in useZeroQuery

### Issue: Permission checks failing
**Solution:** Verify authData extraction, check isAdmin function

### Issue: Query performance slow
**Solution:** Add indexes, optimize query, cache results

### Issue: Breaking changes detected
**Solution:** Rollback, review, fix, test again

---

## 📚 Resources

- [Zero Docs](https://zero.rocicorp.dev/)
- [Full Abstraction Plan](./zero-refactor-abstraction-plan.md)
- [Current Architecture](./zero-synced-queries-auth.md)
- [Schema Reference](../../src/zero-schema.ts)

---

**Last Updated:** 2025-11-02  
**Next Review:** After Week 1

