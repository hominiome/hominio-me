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

    // Drop legacy tables (no longer needed - votes tracked in vote table)
    const legacyTables = [
      "wallet", 
      "transaction", 
      "heartTransaction", 
      "projectVote"
    ];
    
    console.log("🗑️  Cleaning up legacy tables...");
    for (const tableName of legacyTables) {
      try {
        // First remove from publication if it exists
        try {
          await sql`ALTER PUBLICATION zero_data DROP TABLE IF EXISTS ${sql.raw(`"${tableName}"`)}`.execute(db);
          console.log(`   Removed ${tableName} from publication`);
        } catch (e) {
          // Publication might not exist or table not in it, that's fine
        }
        
        // Then drop the table
        await sql`DROP TABLE IF EXISTS ${sql.raw(`"${tableName}"`)} CASCADE`.execute(db);
        console.log(`✅ Dropped legacy table: ${tableName}`);
      } catch (error) {
        console.log(`ℹ️  Table ${tableName} doesn't exist or couldn't be dropped: ${error.message}`);
      }
    }

    // Cup table
    await db.schema
      .createTable("cup")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("name", "text", (col) => col.notNull())
      .addColumn("description", "text")
      .addColumn("creatorId", "text", (col) => col.notNull())
      .addColumn("status", "text", (col) => col.notNull())
      .addColumn("currentRound", "text")
      .addColumn("winnerId", "text")
      .addColumn("createdAt", "text", (col) => col.notNull())
      .addColumn("startedAt", "text")
      .addColumn("completedAt", "text")
      .addColumn("updatedAt", "text")
      .execute();
    console.log("✅ Cup table created");

    // Remove legacy walletId column from cup if it exists
    try {
      await sql`ALTER TABLE cup DROP COLUMN IF EXISTS "walletId"`.execute(db);
      console.log("✅ Removed walletId column from cup table");
    } catch (error) {
      console.log("ℹ️  WalletId column doesn't exist in cup (already removed)");
    }

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

    // Migrate userVotingPackage to userIdentities if it exists
    try {
      const tableExists = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'userVotingPackage'
        )
      `.execute(db);
      
      if (tableExists.rows[0]?.exists) {
        // Rename table
        await sql`ALTER TABLE "userVotingPackage" RENAME TO "userIdentities"`.execute(db);
        console.log("✅ Renamed userVotingPackage table to userIdentities");
        
        // Rename columns
        await sql`ALTER TABLE "userIdentities" RENAME COLUMN "packageType" TO "identityType"`.execute(db);
        await sql`ALTER TABLE "userIdentities" RENAME COLUMN "purchasedAt" TO "selectedAt"`.execute(db);
        console.log("✅ Renamed columns: packageType -> identityType, purchasedAt -> selectedAt");
        
        // Update indexes
        try {
          await sql`ALTER INDEX IF EXISTS "userVotingPackage_userId_idx" RENAME TO "userIdentities_userId_idx"`.execute(db);
          await sql`DROP INDEX IF EXISTS "userVotingPackage_userId_unique"`.execute(db);
          await sql`CREATE UNIQUE INDEX IF NOT EXISTS userIdentities_userId_unique ON "userIdentities" ("userId")`.execute(db);
          console.log("✅ Updated indexes");
        } catch (e) {
          console.log("ℹ️  Index update skipped (may not exist)");
        }
      }
    } catch (error) {
      console.log("ℹ️  Migration from userVotingPackage skipped:", error.message);
    }

    // UserIdentities table
    await db.schema
      .createTable("userIdentities")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("userId", "text", (col) => col.notNull())
      .addColumn("identityType", "text", (col) => col.notNull())
      .addColumn("votingWeight", "integer", (col) => col.notNull())
      .addColumn("selectedAt", "text", (col) => col.notNull())
      .addColumn("upgradedFrom", "text")
      .execute();
    console.log("✅ UserIdentities table created");

    // Add index on userId for userIdentities table
    await db.schema
      .createIndex("userIdentities_userId_idx")
      .ifNotExists()
      .on("userIdentities")
      .column("userId")
      .execute();
    console.log("✅ UserIdentities userId index created");

    // Add unique constraint on userId (one identity per user)
    try {
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS userIdentities_userId_unique ON "userIdentities" ("userId")`.execute(
        db
      );
      console.log("✅ UserIdentities unique constraint on userId created");
    } catch (error) {
      console.log("✅ UserIdentities unique constraint already exists");
    }

    // Enable WAL replication for userIdentities table
    await sql`ALTER TABLE "userIdentities" REPLICA IDENTITY FULL`.execute(db);
    console.log("✅ Enabled replica identity for userIdentities table");

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

    // Remove legacy tables from publication and recreate with only current tables
    try {
      // Drop existing publication
      await sql`DROP PUBLICATION IF EXISTS zero_data`.execute(db);
      console.log("✅ Dropped existing publication");
    } catch (error) {
      console.log("ℹ️  Publication doesn't exist or couldn't be dropped");
    }

    // Create publication with only current tables (no wallet, transaction, heartTransaction, projectVote)
    try {
      await sql`CREATE PUBLICATION zero_data FOR TABLE project, cup, "cupMatch", "userIdentities", vote`.execute(
        db
      );
      console.log("✅ Created publication for Zero (current tables only)");
    } catch (error) {
      if (error.message?.includes("already exists")) {
        // Try to alter the publication
        try {
          // Remove legacy tables from publication
          try {
            await sql`ALTER PUBLICATION zero_data DROP TABLE IF EXISTS wallet, transaction, "heartTransaction", "projectVote", "userVotingPackage"`.execute(db);
            console.log("✅ Removed legacy tables from publication");
          } catch (e) {
            console.log("ℹ️  Could not remove legacy tables from publication (may not exist)");
          }
          
          // Add current tables if not already present
          await sql`ALTER PUBLICATION zero_data ADD TABLE IF NOT EXISTS project, cup, "cupMatch", "userIdentities", vote`.execute(
            db
          );
          console.log("✅ Updated publication to include current tables");
        } catch (alterError) {
          console.log("⚠️ Could not update publication (may need manual update):", alterError.message);
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

