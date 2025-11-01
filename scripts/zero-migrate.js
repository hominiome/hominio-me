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

    // Note: userName and userImage columns have been removed - user data is fetched from profile API
    // Migration scripts should NOT add these deprecated columns

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

    // Add videoThumbnail column if it doesn't exist
    try {
      await sql`ALTER TABLE project ADD COLUMN IF NOT EXISTS "videoThumbnail" TEXT DEFAULT ''`.execute(
        db
      );
      console.log("✅ Project videoThumbnail column added");
    } catch (error) {
      console.log("✅ Project videoThumbnail column already exists");
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
      // Note: creatorName has been removed - creator data is fetched from profile API
      // walletId removed - no longer needed
      .addColumn("status", "text", (col) => col.notNull())
      .addColumn("currentRound", "text")
      .addColumn("winnerId", "text")
      .addColumn("createdAt", "text", (col) => col.notNull())
      .addColumn("startedAt", "text")
      .addColumn("completedAt", "text")
      .addColumn("updatedAt", "text")
      .execute();
    console.log("✅ Cup table created");

    // Add logoImageUrl column if it doesn't exist
    try {
      await sql`ALTER TABLE cup ADD COLUMN IF NOT EXISTS "logoImageUrl" TEXT DEFAULT ''`.execute(
        db
      );
      console.log("✅ Cup logoImageUrl column added");
    } catch (error) {
      console.log("✅ Cup logoImageUrl column already exists");
    }

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
      // project1WalletId and project2WalletId removed - votes tracked in vote table
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

    // UserVotingPackage table
    await db.schema
      .createTable("userVotingPackage")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("userId", "text", (col) => col.notNull())
      .addColumn("packageType", "text", (col) => col.notNull())
      .addColumn("votingWeight", "integer", (col) => col.notNull())
      .addColumn("purchasedAt", "text", (col) => col.notNull())
      .addColumn("upgradedFrom", "text")
      .execute();
    console.log("✅ UserVotingPackage table created");

    // Add index on userId for userVotingPackage table
    await db.schema
      .createIndex("userVotingPackage_userId_idx")
      .ifNotExists()
      .on("userVotingPackage")
      .column("userId")
      .execute();
    console.log("✅ UserVotingPackage userId index created");

    // Add unique constraint on userId (one package per user)
    try {
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS userVotingPackage_userId_unique ON "userVotingPackage" ("userId")`.execute(
        db
      );
      console.log("✅ UserVotingPackage unique constraint on userId created");
    } catch (error) {
      console.log("✅ UserVotingPackage unique constraint already exists");
    }

    // Enable WAL replication for userVotingPackage table
    await sql`ALTER TABLE "userVotingPackage" REPLICA IDENTITY FULL`.execute(db);
    console.log("✅ Enabled replica identity for userVotingPackage table");

    // Vote table
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
    console.log("✅ Vote table created");

    // Add indexes for vote table
    await db.schema
      .createIndex("vote_userId_idx")
      .ifNotExists()
      .on("vote")
      .column("userId")
      .execute();
    await db.schema
      .createIndex("vote_matchId_idx")
      .ifNotExists()
      .on("vote")
      .column("matchId")
      .execute();
    await db.schema
      .createIndex("vote_userId_matchId_idx")
      .ifNotExists()
      .on("vote")
      .columns(["userId", "matchId"])
      .execute();
    console.log("✅ Vote indexes created");

    // Add unique constraint on (userId, matchId) to enforce one vote per user per match
    try {
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS vote_userId_matchId_unique ON vote ("userId", "matchId")`.execute(
        db
      );
      console.log("✅ Vote unique constraint on (userId, matchId) created");
    } catch (error) {
      console.log("✅ Vote unique constraint already exists");
    }

    // Enable WAL replication for vote table
    await sql`ALTER TABLE vote REPLICA IDENTITY FULL`.execute(db);
    console.log("✅ Enabled replica identity for vote table");

    // Create or update publication for Zero with all tables
    try {
      await sql`CREATE PUBLICATION zero_data FOR TABLE project, wallet, transaction, cup, "cupMatch", "userVotingPackage", vote`.execute(
        db
      );
      console.log("✅ Created publication for Zero (all tables)");
    } catch (error) {
      if (error.message?.includes("already exists")) {
        // Try to alter the publication to add new tables
        try {
          await sql`ALTER PUBLICATION zero_data ADD TABLE "userVotingPackage", vote`.execute(
            db
          );
          console.log("✅ Updated publication to include new tables");
        } catch (alterError) {
          if (alterError.message?.includes("already exists")) {
            console.log("✅ Publication already includes new tables");
          } else {
            console.log("⚠️ Could not update publication (may need manual update)");
          }
        }
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

