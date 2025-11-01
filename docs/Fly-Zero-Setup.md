# Fly.io Zero Service Setup

## Critical: Use Direct Connection (Not Pooler)

Zero requires a **direct database connection** (not a connection pooler) for logical replication slots. 

### The Problem

If you use Neon's pooler connection (`-pooler.neon.tech`), you'll see errors like:
```
terminating connection due to administrator command
shutdown signal received (e.g. another zero-cache taking over the replication stream)
```

This happens because connection poolers don't support long-lived replication connections.

### Solution

1. **Convert your pooler URL to a direct connection:**

```bash
bun scripts/convert-to-direct-connection.js <your-pooler-connection-string>
```

2. **Set the direct connection in Fly.io secrets:**

```bash
fly secrets set ZERO_UPSTREAM_DB="<direct-connection-string>" -a hominio-me-sync
```

### Example

**Pooler (won't work):**
```
postgres://user:pass@ep-xxx-pooler.c-2.eu-central-1.aws.neon.tech/dbname
```

**Direct (required):**
```
postgres://user:pass@ep-xxx.c-2.eu-central-1.aws.neon.tech/dbname?sslmode=require
```

### Verify Setup

1. Check current secrets:
```bash
fly secrets list -a hominio-me-sync
```

2. Verify Zero is using direct connection:
```bash
fly logs -a hominio-me-sync | grep "neondb@"
```

Should show connection to `ep-xxx.c-2.eu-central-1.aws.neon.tech` (NOT `-pooler`)

3. Check replication is working:
```bash
fly logs -a hominio-me-sync | grep "replication"
```

Should see: `"started replication stream"` without frequent resets.

