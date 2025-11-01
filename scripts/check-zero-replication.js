import { Kysely, sql } from "kysely";
import { NeonDialect } from "kysely-neon";
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.SECRET_ZERO_DEV_PG;

if (!DATABASE_URL) {
  console.error("❌ SECRET_ZERO_DEV_PG environment variable is required");
  process.exit(1);
}

const db = new Kysely({
  dialect: new NeonDialect({
    neon: neon(DATABASE_URL),
  }),
});

async function checkReplication() {
  console.log("🔍 Checking Zero replication setup...\n");

  try {
    // Check if publication exists
    const publication = await sql`
      SELECT * FROM pg_publication WHERE pubname = 'zero_data'
    `.execute(db);

    if (publication.rows.length === 0) {
      console.log("❌ Publication 'zero_data' does not exist!");
      console.log("💡 Run: bun run scripts/zero-migrate.js");
      return;
    }

    console.log("✅ Publication 'zero_data' exists");

    // Check which tables are in the publication
    const pubTables = await sql`
      SELECT tablename 
      FROM pg_publication_tables 
      WHERE pubname = 'zero_data'
      ORDER BY tablename
    `.execute(db);

    console.log("\n📋 Tables in publication:");
    pubTables.rows.forEach((row) => {
      console.log(`   - ${row.tablename}`);
    });

    // Check REPLICA IDENTITY for each table
    const tables = ["project", "wallet", "transaction", "cup", "cupMatch"];
    console.log("\n🔍 Checking REPLICA IDENTITY for tables:");
    
    for (const table of tables) {
      const tableName = table === "cupMatch" ? '"cupMatch"' : table;
      const replicaIdentity = await sql`
        SELECT relreplident 
        FROM pg_class 
        WHERE relname = ${table}
      `.execute(db);

      if (replicaIdentity.rows.length > 0) {
        const ident = replicaIdentity.rows[0].relreplident;
        const identName = ident === "f" ? "FULL" : ident === "d" ? "DEFAULT" : ident === "n" ? "NOTHING" : "INDEX";
        const status = ident === "f" ? "✅" : "⚠️";
        console.log(`   ${status} ${table}: ${identName}`);
        
        if (ident !== "f") {
          console.log(`      ⚠️  Should be FULL for proper replication`);
        }
      } else {
        console.log(`   ❌ ${table}: Table not found`);
      }
    }

    // Check if logical replication is enabled
    const walLevel = await sql`
      SHOW wal_level
    `.execute(db);

    console.log(`\n📊 WAL Level: ${walLevel.rows[0]?.wal_level || "unknown"}`);
    
    if (walLevel.rows[0]?.wal_level !== "logical") {
      console.log("⚠️  WAL level should be 'logical' for Zero replication");
      console.log("💡 This is usually set at the database provider level (Neon, etc.)");
    }

    console.log("\n✅ Replication check complete!");
    console.log("\n💡 If data is stale:");
    console.log("   1. Ensure zero-cache is running");
    console.log("   2. Restart zero-cache to force fresh sync");
    console.log("   3. Refresh the browser page to reconnect");
    console.log("   4. Check zero-cache logs for errors");

  } catch (error) {
    console.error("❌ Error checking replication:", error);
    throw error;
  } finally {
    await db.destroy();
  }
}

checkReplication()
  .then(() => {
    console.log("\n🎉 Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Check failed:", error);
    process.exit(1);
  });

