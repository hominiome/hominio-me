import { Kysely, sql } from "kysely";
import { NeonDialect } from "kysely-neon";
import { neon } from "@neondatabase/serverless";

// Bun automatically loads .env file
const DATABASE_URL = process.env.SECRET_ZERO_DEV_PG;

if (!DATABASE_URL) {
  console.error("❌ SECRET_ZERO_DEV_PG environment variable is required");
  console.error(
    "💡 Make sure you have a .env file with SECRET_ZERO_DEV_PG set"
  );
  process.exit(1);
}

const db = new Kysely({
  dialect: new NeonDialect({
    neon: neon(DATABASE_URL),
  }),
});

async function createTables() {
  console.log("🚀 Starting Zero database migration...");

  try {
    // Project table (public read, owner-only write)
    await db.schema
      .createTable("project")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("title", "text", (col) => col.notNull())
      .addColumn("description", "text", (col) => col.notNull())
      .addColumn("city", "text", (col) => col.notNull())
      .addColumn("userId", "text", (col) => col.notNull())
      .addColumn("createdAt", "text", (col) => col.notNull())
      .execute();
    console.log("✅ Project table created");

    // Add userName column if it doesn't exist
    try {
      await sql`ALTER TABLE project ADD COLUMN IF NOT EXISTS "userName" TEXT DEFAULT ''`.execute(
        db
      );
      console.log("✅ Project userName column added");
    } catch (error) {
      console.log("✅ Project userName column already exists");
    }

    // Add userImage column if it doesn't exist
    try {
      await sql`ALTER TABLE project ADD COLUMN IF NOT EXISTS "userImage" TEXT DEFAULT ''`.execute(
        db
      );
      console.log("✅ Project userImage column added");
    } catch (error) {
      console.log("✅ Project userImage column already exists");
    }

    // Add sdgs column if it doesn't exist
    try {
      await sql`ALTER TABLE project ADD COLUMN IF NOT EXISTS "sdgs" TEXT DEFAULT '[]'`.execute(
        db
      );
      console.log("✅ Project sdgs column added");
    } catch (error) {
      console.log("✅ Project sdgs column already exists");
    }

    // Add videoUrl column if it doesn't exist
    try {
      await sql`ALTER TABLE project ADD COLUMN IF NOT EXISTS "videoUrl" TEXT DEFAULT ''`.execute(
        db
      );
      console.log("✅ Project videoUrl column added");
    } catch (error) {
      console.log("✅ Project videoUrl column already exists");
    }

    // Add index on userId for project table
    await db.schema
      .createIndex("project_userId_idx")
      .ifNotExists()
      .on("project")
      .column("userId")
      .execute();
    console.log("✅ Project userId index created");

    // Enable WAL replication for project table
    await sql`ALTER TABLE project REPLICA IDENTITY FULL`.execute(db);
    console.log("✅ Enabled replica identity for project table");

    // Wallet table
    await db.schema
      .createTable("wallet")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("entityType", "text", (col) => col.notNull())
      .addColumn("entityId", "text", (col) => col.notNull())
      .addColumn("balance", "integer", (col) => col.notNull().defaultTo(0))
      .addColumn("createdAt", "text", (col) => col.notNull())
      .addColumn("updatedAt", "text", (col) => col.notNull())
      .execute();
    console.log("✅ Wallet table created");

    // Add indexes for wallet table
    await db.schema
      .createIndex("wallet_entityType_entityId_idx")
      .ifNotExists()
      .on("wallet")
      .columns(["entityType", "entityId"])
      .execute();
    console.log("✅ Wallet entity index created");

    // Enable WAL replication for wallet table
    await sql`ALTER TABLE wallet REPLICA IDENTITY FULL`.execute(db);
    console.log("✅ Enabled replica identity for wallet table");

    // Transaction table
    await db.schema
      .createTable("transaction")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("fromWalletId", "text")
      .addColumn("toWalletId", "text")
      .addColumn("amount", "integer", (col) => col.notNull())
      .addColumn("type", "text", (col) => col.notNull())
      .addColumn("metadata", "text")
      .addColumn("createdAt", "text", (col) => col.notNull())
      .execute();
    console.log("✅ Transaction table created");

    // Add indexes for transaction table
    await db.schema
      .createIndex("transaction_fromWalletId_idx")
      .ifNotExists()
      .on("transaction")
      .column("fromWalletId")
      .execute();
    await db.schema
      .createIndex("transaction_toWalletId_idx")
      .ifNotExists()
      .on("transaction")
      .column("toWalletId")
      .execute();
    console.log("✅ Transaction indexes created");

    // Enable WAL replication for transaction table
    await sql`ALTER TABLE transaction REPLICA IDENTITY FULL`.execute(db);
    console.log("✅ Enabled replica identity for transaction table");

    // Cup table
    await db.schema
      .createTable("cup")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("name", "text", (col) => col.notNull())
      .addColumn("description", "text")
      .addColumn("creatorId", "text", (col) => col.notNull())
      .addColumn("creatorName", "text")
      .addColumn("walletId", "text")
      .addColumn("status", "text", (col) => col.notNull())
      .addColumn("currentRound", "text")
      .addColumn("winnerId", "text")
      .addColumn("createdAt", "text", (col) => col.notNull())
      .addColumn("startedAt", "text")
      .addColumn("completedAt", "text")
      .addColumn("updatedAt", "text")
      .execute();
    console.log("✅ Cup table created");

    // Add index on creatorId for cup table
    await db.schema
      .createIndex("cup_creatorId_idx")
      .ifNotExists()
      .on("cup")
      .column("creatorId")
      .execute();
    console.log("✅ Cup creatorId index created");

    // Enable WAL replication for cup table
    await sql`ALTER TABLE cup REPLICA IDENTITY FULL`.execute(db);
    console.log("✅ Enabled replica identity for cup table");

    // CupMatch table
    await db.schema
      .createTable("cupMatch")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("cupId", "text", (col) => col.notNull())
      .addColumn("round", "text", (col) => col.notNull())
      .addColumn("position", "integer", (col) => col.notNull())
      .addColumn("project1Id", "text")
      .addColumn("project2Id", "text")
      .addColumn("project1WalletId", "text")
      .addColumn("project2WalletId", "text")
      .addColumn("winnerId", "text")
      .addColumn("status", "text", (col) => col.notNull())
      .addColumn("completedAt", "text")
      .execute();
    console.log("✅ CupMatch table created");

    // Add indexes for cupMatch table
    await db.schema
      .createIndex("cupMatch_cupId_idx")
      .ifNotExists()
      .on("cupMatch")
      .column("cupId")
      .execute();
    await db.schema
      .createIndex("cupMatch_cupId_round_position_idx")
      .ifNotExists()
      .on("cupMatch")
      .columns(["cupId", "round", "position"])
      .execute();
    console.log("✅ CupMatch indexes created");

    // Enable WAL replication for cupMatch table
    await sql`ALTER TABLE "cupMatch" REPLICA IDENTITY FULL`.execute(db);
    console.log("✅ Enabled replica identity for cupMatch table");

    // Create or update publication for Zero with all tables
    try {
      await sql`CREATE PUBLICATION zero_data FOR TABLE project, wallet, transaction, cup, "cupMatch"`.execute(
        db
      );
      console.log("✅ Created publication for Zero (all tables)");
    } catch (error) {
      if (error.message?.includes("already exists")) {
        console.log("✅ Publication already exists");
      } else {
        throw error;
      }
    }

    console.log("🎉 Zero database migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }
}

createTables()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

