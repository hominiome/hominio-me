/**
 * Migration script to remove creatorName column from cup table
 * 
 * Run this script to clean up existing data:
 * bun run scripts/remove-creatorName-from-cups.js
 */

import { Kysely } from "kysely";
import { NeonDialect } from "kysely-neon";
import { neon } from "@neondatabase/serverless";

// Bun automatically loads .env file
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

async function migrate() {
  console.log("🔄 Starting migration to remove creatorName from cup table...");

  try {
    // Check if column exists first (PostgreSQL specific)
    const columns = await db
      .selectFrom("information_schema.columns")
      .select("column_name")
      .where("table_name", "=", "cup")
      .where("table_schema", "=", "public")
      .execute();

    const columnNames = columns.map((c) => c.column_name);
    const hasCreatorName = columnNames.includes("creatorName");

    if (!hasCreatorName) {
      console.log("✅ Column creatorName doesn't exist. Migration already complete.");
      return;
    }

    // Drop column if it exists
    console.log("  → Dropping creatorName column...");
    await db.schema.alterTable("cup").dropColumn("creatorName").execute();
    console.log("  ✅ Dropped creatorName column");

    console.log("✅ Migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await db.destroy();
  }
}

migrate()
  .then(() => {
    console.log("🎉 Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Migration failed:", error);
    process.exit(1);
  });

