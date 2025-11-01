/**
 * Script to refresh Zero replication after schema changes
 * This triggers Zero to pick up new columns by making innocuous UPDATEs
 * 
 * Run this after adding columns to existing tables:
 * bun run scripts/refresh-zero-schema.js
 */

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

async function refreshSchema() {
  console.log("🔄 Refreshing Zero schema replication...");

  try {
    // Make innocuous UPDATEs to trigger Zero to sync new columns
    // This is required after adding columns to existing tables
    
    // Update project table (for videoThumbnail column)
    // Use a simple UPDATE that doesn't change anything to trigger replication
    const projectCount = await db
      .selectFrom("project")
      .select(db.fn.count("id").as("count"))
      .executeTakeFirst();
    
    if (projectCount && Number(projectCount.count) > 0) {
      // Update the first project's title to itself (no-op update)
      const firstProject = await db
        .selectFrom("project")
        .select("id")
        .select("title")
        .limit(1)
        .executeTakeFirst();
      
      if (firstProject) {
        await db
          .updateTable("project")
          .set({ title: firstProject.title })
          .where("id", "=", firstProject.id)
          .execute();
        console.log("✅ Triggered project table replication refresh");
      }
    } else {
      console.log("ℹ️  No projects to update (table is empty)");
    }

    // Update cup table (for logoImageUrl column)
    const cupCount = await db
      .selectFrom("cup")
      .select(db.fn.count("id").as("count"))
      .executeTakeFirst();
    
    if (cupCount && Number(cupCount.count) > 0) {
      await sql`UPDATE cup SET "updatedAt" = "updatedAt" WHERE id = (SELECT id FROM cup LIMIT 1)`.execute(db);
      console.log("✅ Triggered cup table replication refresh");
    } else {
      console.log("ℹ️  No cups to update (table is empty)");
    }

    console.log("✅ Schema refresh completed!");
    console.log("💡 Note: If zero-cache is running, it should automatically pick up the schema changes.");
    console.log("💡 If data still doesn't appear, try restarting zero-cache.");
  } catch (error) {
    console.error("❌ Schema refresh failed:", error);
    throw error;
  } finally {
    await db.destroy();
  }
}

refreshSchema()
  .then(() => {
    console.log("🎉 Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Refresh failed:", error);
    process.exit(1);
  });

