/**
 * Migration script to remove userName and userImage columns from project table
 * 
 * Run this script to clean up existing data:
 * node scripts/remove-user-fields-from-projects.js
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
  console.log("🔄 Starting migration to remove userName and userImage from project table...");

  try {
    // Check if columns exist first (PostgreSQL specific)
    const columns = await db
      .selectFrom("information_schema.columns")
      .select("column_name")
      .where("table_name", "=", "project")
      .where("table_schema", "=", "public")
      .execute();

    const columnNames = columns.map((c) => c.column_name);
    const hasUserName = columnNames.includes("userName");
    const hasUserImage = columnNames.includes("userImage");

    if (!hasUserName && !hasUserImage) {
      console.log("✅ Columns userName and userImage don't exist. Migration already complete.");
      return;
    }

    // Drop columns if they exist
    if (hasUserName) {
      console.log("  → Dropping userName column...");
      await db.schema.alterTable("project").dropColumn("userName").execute();
      console.log("  ✅ Dropped userName column");
    }

    if (hasUserImage) {
      console.log("  → Dropping userImage column...");
      await db.schema.alterTable("project").dropColumn("userImage").execute();
      console.log("  ✅ Dropped userImage column");
    }

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

