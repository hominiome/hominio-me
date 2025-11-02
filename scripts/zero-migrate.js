import { Kysely, sql } from "kysely";
import { NeonDialect } from "kysely-neon";
import { neon } from "@neondatabase/serverless";

// Bun automatically loads .env file
const DATABASE_URL = process.env.SECRET_ZERO_DEV_PG;

if (!DATABASE_URL) {
  console.error("❌ SECRET_ZERO_DEV_PG environment variable is required");
  console.error("💡 Make sure you have a .env file with SECRET_ZERO_DEV_PG set");
  process.exit(1);
}

const db = new Kysely({
  dialect: new NeonDialect({
    neon: neon(DATABASE_URL),
  }),
});

/**
 * Clean migration system for Zero database schema
 * Creates all 7 tables from scratch based on zero-schema.ts
 */
async function createTables() {
  console.log("🚀 Creating Zero database schema...\n");

  try {
    // 1. Project table
    console.log("📊 Creating project table...");
    await db.schema
      .createTable("project")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("title", "text", (col) => col.notNull())
      .addColumn("description", "text", (col) => col.notNull())
      .addColumn("country", "text", (col) => col.notNull())
      .addColumn("city", "text", (col) => col.notNull())
      .addColumn("userId", "text", (col) => col.notNull())
      .addColumn("videoUrl", "text", (col) => col.notNull().defaultTo(""))
      .addColumn("bannerImage", "text", (col) => col.notNull().defaultTo(""))
      .addColumn("profileImageUrl", "text", (col) => col.notNull().defaultTo(""))
      .addColumn("sdgs", "text", (col) => col.notNull().defaultTo("[]"))
      .addColumn("createdAt", "text", (col) => col.notNull())
      .execute();
    console.log("✅ Project table created\n");

    // 2. Cup table
    console.log("🏆 Creating cup table...");
    await db.schema
      .createTable("cup")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("name", "text", (col) => col.notNull())
      .addColumn("description", "text", (col) => col.notNull().defaultTo(""))
      .addColumn("creatorId", "text", (col) => col.notNull())
      .addColumn("logoImageUrl", "text", (col) => col.notNull().defaultTo(""))
      .addColumn("size", "integer", (col) => col.notNull())
      .addColumn("selectedProjectIds", "text", (col) => col.notNull().defaultTo(""))
      .addColumn("status", "text", (col) => col.notNull().defaultTo("draft"))
      .addColumn("currentRound", "text", (col) => col.notNull().defaultTo(""))
      .addColumn("winnerId", "text", (col) => col.notNull().defaultTo(""))
      .addColumn("createdAt", "text", (col) => col.notNull())
      .addColumn("startedAt", "text", (col) => col.notNull().defaultTo(""))
      .addColumn("completedAt", "text", (col) => col.notNull().defaultTo(""))
      .addColumn("updatedAt", "text", (col) => col.notNull().defaultTo(""))
      .addColumn("endDate", "text", (col) => col.notNull().defaultTo(""))
      .execute();
    console.log("✅ Cup table created\n");

    // 3. CupMatch table
    console.log("🎯 Creating cupMatch table...");
    await db.schema
      .createTable("cupMatch")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("cupId", "text", (col) => col.notNull())
      .addColumn("round", "text", (col) => col.notNull())
      .addColumn("position", "integer", (col) => col.notNull())
      .addColumn("project1Id", "text", (col) => col.notNull().defaultTo(""))
      .addColumn("project2Id", "text", (col) => col.notNull().defaultTo(""))
      .addColumn("winnerId", "text", (col) => col.notNull().defaultTo(""))
      .addColumn("status", "text", (col) => col.notNull().defaultTo("pending"))
      .addColumn("completedAt", "text", (col) => col.notNull().defaultTo(""))
      .addColumn("endDate", "text", (col) => col.notNull().defaultTo(""))
      .execute();
    console.log("✅ CupMatch table created\n");

    // 4. UserIdentities table
    console.log("👤 Creating userIdentities table...");
    await db.schema
      .createTable("userIdentities")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("userId", "text", (col) => col.notNull())
      .addColumn("cupId", "text", (col) => col.notNull().defaultTo(""))
      .addColumn("identityType", "text", (col) => col.notNull())
      .addColumn("votingWeight", "integer", (col) => col.notNull())
      .addColumn("selectedAt", "text", (col) => col.notNull())
      .addColumn("upgradedFrom", "text", (col) => col.notNull().defaultTo(""))
      .execute();
    console.log("✅ UserIdentities table created\n");

    // 5. IdentityPurchase table
    console.log("💰 Creating identityPurchase table...");
    await db.schema
      .createTable("identityPurchase")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("userId", "text", (col) => col.notNull())
      .addColumn("cupId", "text", (col) => col.notNull())
      .addColumn("identityType", "text", (col) => col.notNull())
      .addColumn("price", "integer", (col) => col.notNull())
      .addColumn("purchasedAt", "text", (col) => col.notNull())
      .addColumn("userIdentityId", "text", (col) => col.notNull())
      .execute();
    console.log("✅ IdentityPurchase table created\n");

    // 6. Vote table
    console.log("🗳️  Creating vote table...");
    await db.schema
      .createTable("vote")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("userId", "text", (col) => col.notNull())
      .addColumn("matchId", "text", (col) => col.notNull())
      .addColumn("projectSide", "text", (col) => col.notNull())
      .addColumn("votingWeight", "integer", (col) => col.notNull())
      .addColumn("createdAt", "text", (col) => col.notNull())
      .execute();
    console.log("✅ Vote table created\n");

    // 7. Notification table
    console.log("🔔 Creating notification table...");
    await db.schema
      .createTable("notification")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("userId", "text", (col) => col.notNull())
      .addColumn("resourceType", "text", (col) => col.notNull().defaultTo(""))
      .addColumn("resourceId", "text", (col) => col.notNull().defaultTo(""))
      .addColumn("title", "text", (col) => col.notNull())
      .addColumn("previewTitle", "text", (col) => col.notNull().defaultTo(""))
      .addColumn("message", "text", (col) => col.notNull())
      .addColumn("read", "text", (col) => col.notNull().defaultTo("false"))
      .addColumn("createdAt", "text", (col) => col.notNull())
      .addColumn("actions", "text", (col) => col.notNull().defaultTo("[]"))
      .addColumn("sound", "text", (col) => col.notNull().defaultTo(""))
      .addColumn("icon", "text", (col) => col.notNull().defaultTo(""))
      .addColumn("displayComponent", "text", (col) => col.notNull().defaultTo(""))
      .addColumn("priority", "text", (col) => col.notNull().defaultTo("false"))
      .execute();
    console.log("✅ Notification table created\n");

    // Setup replication for all tables
    await setupReplication();

    console.log("🎉 Zero database schema created successfully!\n");
    console.log("⚠️  IMPORTANT: Restart your Zero cache server to pick up schema changes!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }
}

/**
 * Setup PostgreSQL logical replication for Zero
 * Enables replica identity and creates publication for all tables
 */
async function setupReplication() {
  console.log("🔄 Setting up replication...\n");

  const tables = [
    "project",
    "cup",
    "cupMatch",
    "userIdentities",
    "identityPurchase",
    "vote",
    "notification",
  ];

  // Enable replica identity for all tables
  for (const table of tables) {
    try {
      const quotedTable = ["cupMatch", "userIdentities", "identityPurchase"].includes(table)
        ? `"${table}"`
        : table;
      
      await sql`ALTER TABLE ${sql.raw(quotedTable)} REPLICA IDENTITY FULL`.execute(db);
      console.log(`✅ Enabled replica identity for ${table}`);
    } catch (error) {
      console.log(`ℹ️  Replica identity already set for ${table}`);
    }
  }

  console.log();

  // Create or update publication
  try {
    await sql`CREATE PUBLICATION zero_data FOR TABLE project, cup, "cupMatch", "userIdentities", "identityPurchase", vote, notification`.execute(
      db
    );
    console.log("✅ Created publication 'zero_data'\n");
  } catch (error) {
    if (error.message?.includes("already exists")) {
      console.log("ℹ️  Publication 'zero_data' already exists\n");
      
      // Ensure all current tables are included
      try {
        await sql`ALTER PUBLICATION zero_data SET TABLE project, cup, "cupMatch", "userIdentities", "identityPurchase", vote, notification`.execute(
          db
        );
        console.log("✅ Updated publication to include all tables\n");
      } catch (alterError) {
        console.log("ℹ️  Publication already up to date\n");
      }
    } else {
      throw error;
    }
  }

  console.log("✅ Replication setup complete\n");
}

// Run migration
createTables()
  .then(() => {
    console.log("✨ Migration completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Migration failed:", error.message);
    process.exit(1);
  });
