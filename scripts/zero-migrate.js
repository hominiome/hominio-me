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

    // Add country column if it doesn't exist
    try {
      await sql`ALTER TABLE project ADD COLUMN IF NOT EXISTS "country" TEXT DEFAULT ''`.execute(
        db
      );
      console.log("✅ Project country column added");
    } catch (error) {
      console.log("✅ Project country column already exists");
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

    // Remove legacy walletId columns from cupMatch if they exist
    try {
      await sql`ALTER TABLE "cupMatch" DROP COLUMN IF EXISTS "project1WalletId"`.execute(
        db
      );
      await sql`ALTER TABLE "cupMatch" DROP COLUMN IF EXISTS "project2WalletId"`.execute(
        db
      );
      console.log(
        "✅ Removed project1WalletId and project2WalletId columns from cupMatch table"
      );
    } catch (error) {
      console.log(
        "ℹ️  WalletId columns don't exist in cupMatch (already removed)"
      );
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

    // Add endDate column to cup if it doesn't exist
    try {
      await sql`ALTER TABLE cup ADD COLUMN IF NOT EXISTS "endDate" TEXT DEFAULT ''`.execute(
        db
      );
      console.log("✅ Cup endDate column added");
    } catch (error) {
      console.log("✅ Cup endDate column already exists");
    }

    // Add size column to cup if it doesn't exist
    try {
      await sql`ALTER TABLE cup ADD COLUMN IF NOT EXISTS "size" INTEGER DEFAULT 16`.execute(
        db
      );
      console.log("✅ Cup size column added");
    } catch (error) {
      console.log("✅ Cup size column already exists");
    }

    // Add selectedProjectIds column to cup if it doesn't exist
    try {
      await sql`ALTER TABLE cup ADD COLUMN IF NOT EXISTS "selectedProjectIds" TEXT DEFAULT '[]'`.execute(
        db
      );
      console.log("✅ Cup selectedProjectIds column added");
    } catch (error) {
      console.log("✅ Cup selectedProjectIds column already exists");
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

    // Add endDate column to cupMatch if it doesn't exist
    try {
      await sql`ALTER TABLE "cupMatch" ADD COLUMN IF NOT EXISTS "endDate" TEXT DEFAULT ''`.execute(
        db
      );
      console.log("✅ CupMatch endDate column added");
    } catch (error) {
      console.log("✅ CupMatch endDate column already exists");
    }

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
        await sql`ALTER TABLE "userVotingPackage" RENAME TO "userIdentities"`.execute(
          db
        );
        console.log("✅ Renamed userVotingPackage table to userIdentities");

        // Rename columns
        await sql`ALTER TABLE "userIdentities" RENAME COLUMN "packageType" TO "identityType"`.execute(
          db
        );
        await sql`ALTER TABLE "userIdentities" RENAME COLUMN "purchasedAt" TO "selectedAt"`.execute(
          db
        );
        console.log(
          "✅ Renamed columns: packageType -> identityType, purchasedAt -> selectedAt"
        );

        // Update indexes
        try {
          await sql`ALTER INDEX IF EXISTS "userVotingPackage_userId_idx" RENAME TO "userIdentities_userId_idx"`.execute(
            db
          );
          await sql`DROP INDEX IF EXISTS "userVotingPackage_userId_unique"`.execute(
            db
          );
          // Don't create userId-only unique constraint - we want multiple identities per user (one per cup)
          // The compound unique constraint (userId, cupId) will be created later
          console.log("✅ Updated indexes");
        } catch (e) {
          console.log("ℹ️  Index update skipped (may not exist)");
        }
      }
    } catch (error) {
      console.log(
        "ℹ️  Migration from userVotingPackage skipped:",
        error.message
      );
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

    // Add cupId column to userIdentities if it doesn't exist
    try {
      await sql`ALTER TABLE "userIdentities" ADD COLUMN IF NOT EXISTS "cupId" TEXT`.execute(
        db
      );
      console.log("✅ UserIdentities cupId column added");

      // For existing records without cupId, we need to handle them
      // Check if there are any records without cupId
      const recordsWithoutCupId = await sql`
        SELECT COUNT(*) as count FROM "userIdentities" WHERE "cupId" IS NULL
      `.execute(db);

      if (recordsWithoutCupId.rows[0]?.count > 0) {
        console.log(
          `⚠️  Found ${recordsWithoutCupId.rows[0].count} userIdentities records without cupId`
        );
        console.log("⚠️  These records will need to be migrated or deleted");
        console.log(
          "⚠️  Consider assigning them to a default cup or deleting them"
        );
      }
    } catch (error) {
      console.log("✅ UserIdentities cupId column already exists");
    }

    // Add index on userId for userIdentities table
    await db.schema
      .createIndex("userIdentities_userId_idx")
      .ifNotExists()
      .on("userIdentities")
      .column("userId")
      .execute();
    console.log("✅ UserIdentities userId index created");

    // Add index on cupId for userIdentities table
    try {
      await db.schema
        .createIndex("userIdentities_cupId_idx")
        .ifNotExists()
        .on("userIdentities")
        .column("cupId")
        .execute();
      console.log("✅ UserIdentities cupId index created");
    } catch (error) {
      console.log("✅ UserIdentities cupId index already exists");
    }

    // Remove old unique constraint on userId (now allows multiple identities per user, one per cup)
    try {
      // Try dropping as index first
      await sql`DROP INDEX IF EXISTS userIdentities_userId_unique`.execute(db);
      console.log("✅ Removed old unique index on userId");
    } catch (error) {
      console.log("ℹ️  Old unique index doesn't exist");
    }
    
    try {
      // Try dropping as constraint (might be named differently)
      await sql`ALTER TABLE "userIdentities" DROP CONSTRAINT IF EXISTS userIdentities_userId_unique`.execute(db);
      console.log("✅ Removed old unique constraint on userId");
    } catch (error) {
      console.log("ℹ️  Old unique constraint doesn't exist");
    }
    
    try {
      // Try dropping the uservotingpackage constraint (old name)
      await sql`ALTER TABLE "userIdentities" DROP CONSTRAINT IF EXISTS uservotingpackage_userid_unique`.execute(db);
      console.log("✅ Removed old uservotingpackage_userid_unique constraint");
    } catch (error) {
      console.log("ℹ️  Old uservotingpackage constraint doesn't exist");
    }
    
    try {
      // Try dropping as index with old name
      await sql`DROP INDEX IF EXISTS uservotingpackage_userid_unique`.execute(db);
      console.log("✅ Removed old uservotingpackage index");
    } catch (error) {
      console.log("ℹ️  Old uservotingpackage index doesn't exist");
    }

    // Add unique constraint on (userId, cupId) - one identity per user per cup
    try {
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS userIdentities_userId_cupId_unique ON "userIdentities" ("userId", "cupId")`.execute(
        db
      );
      console.log(
        "✅ UserIdentities unique constraint on (userId, cupId) created"
      );
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

    // IdentityPurchase table - check if it exists first
    const identityPurchaseExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'identityPurchase'
      )
    `.execute(db);

    if (!identityPurchaseExists.rows[0]?.exists) {
      await db.schema
        .createTable("identityPurchase")
        .addColumn("id", "text", (col) => col.primaryKey())
        .addColumn("userId", "text", (col) => col.notNull())
        .addColumn("cupId", "text", (col) => col.notNull())
        .addColumn("identityType", "text", (col) => col.notNull())
        .addColumn("price", "integer", (col) => col.notNull()) // Price in cents
        .addColumn("purchasedAt", "text", (col) => col.notNull())
        .addColumn("userIdentityId", "text", (col) => col.notNull())
        .execute();
      console.log("✅ IdentityPurchase table created");
    } else {
      console.log(
        "ℹ️  IdentityPurchase table already exists, verifying structure..."
      );
      // Verify all required columns exist
      const columns = await sql`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'identityPurchase'
        ORDER BY ordinal_position
      `.execute(db);
      const columnNames = columns.rows.map((r) => r.column_name);
      const requiredColumns = [
        "id",
        "userId",
        "cupId",
        "identityType",
        "price",
        "purchasedAt",
        "userIdentityId",
      ];
      const missingColumns = requiredColumns.filter(
        (col) => !columnNames.includes(col)
      );
      if (missingColumns.length > 0) {
        console.log(
          `⚠️  Missing columns in identityPurchase: ${missingColumns.join(", ")}`
        );
        // Add missing columns
        for (const col of missingColumns) {
          try {
            if (col === "id") {
              // Can't add primary key column, table structure is wrong
              console.log(
                `⚠️  Cannot add ${col} column - table structure issue`
              );
            } else if (col === "price") {
              await sql`ALTER TABLE "identityPurchase" ADD COLUMN IF NOT EXISTS "${col}" INTEGER NOT NULL DEFAULT 0`.execute(
                db
              );
            } else {
              await sql`ALTER TABLE "identityPurchase" ADD COLUMN IF NOT EXISTS "${col}" TEXT NOT NULL DEFAULT ''`.execute(
                db
              );
            }
            console.log(`✅ Added missing column: ${col}`);
          } catch (error) {
            console.log(`⚠️  Could not add column ${col}:`, error.message);
          }
        }
      } else {
        console.log("✅ IdentityPurchase table structure verified");
      }
    }

    // Add indexes for identityPurchase table
    await db.schema
      .createIndex("identityPurchase_userId_idx")
      .ifNotExists()
      .on("identityPurchase")
      .column("userId")
      .execute();
    await db.schema
      .createIndex("identityPurchase_cupId_idx")
      .ifNotExists()
      .on("identityPurchase")
      .column("cupId")
      .execute();
    console.log("✅ IdentityPurchase indexes created");

    // Enable WAL replication for identityPurchase table
    await sql`ALTER TABLE "identityPurchase" REPLICA IDENTITY FULL`.execute(db);
    console.log("✅ Enabled replica identity for identityPurchase table");

    // Notification table
    await db.schema
      .createTable("notification")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("userId", "text", (col) => col.notNull())
      .addColumn("resourceType", "text", (col) => col.notNull())
      .addColumn("resourceId", "text", (col) => col.notNull())
      .addColumn("title", "text", (col) => col.notNull())
      .addColumn("previewTitle", "text", (col) => col.defaultTo(null))
      .addColumn("message", "text", (col) => col.notNull())
      .addColumn("read", "text", (col) => col.notNull().defaultTo("false"))
      .addColumn("createdAt", "text", (col) => col.notNull())
      .addColumn("actions", "text", (col) => col.defaultTo("[]"))
      .addColumn("sound", "text", (col) => col.defaultTo(null))
      .addColumn("icon", "text", (col) => col.defaultTo(null))
      .addColumn("displayComponent", "text", (col) => col.defaultTo(null))
      .addColumn("priority", "text", (col) => col.defaultTo("false"))
      .execute();
    console.log("✅ Notification table created");

    // Add actions column to existing notification table if it doesn't exist
    try {
      await db.schema
        .alterTable("notification")
        .addColumn("actions", "text", (col) => col.defaultTo("[]"))
        .execute();
      console.log("✅ Added actions column to notification table");
    } catch (error) {
      if (error.message?.includes("duplicate column") || error.message?.includes("already exists")) {
        console.log("ℹ️  actions column already exists in notification table");
      } else {
        console.log("⚠️  Could not add actions column:", error.message);
      }
    }

    // Add sound column to existing notification table if it doesn't exist
    try {
      await db.schema
        .alterTable("notification")
        .addColumn("sound", "text", (col) => col.defaultTo(null))
        .execute();
      console.log("✅ Added sound column to notification table");
    } catch (error) {
      if (error.message?.includes("duplicate column") || error.message?.includes("already exists")) {
        console.log("ℹ️  sound column already exists in notification table");
      } else {
        console.log("⚠️  Could not add sound column:", error.message);
      }
    }

    // Add icon column to existing notification table if it doesn't exist
    try {
      await db.schema
        .alterTable("notification")
        .addColumn("icon", "text", (col) => col.defaultTo(null))
        .execute();
      console.log("✅ Added icon column to notification table");
    } catch (error) {
      if (error.message?.includes("duplicate column") || error.message?.includes("already exists")) {
        console.log("ℹ️  icon column already exists in notification table");
      } else {
        console.log("⚠️  Could not add icon column:", error.message);
      }
    }

    // Add displayComponent column to existing notification table if it doesn't exist
    try {
      await db.schema
        .alterTable("notification")
        .addColumn("displayComponent", "text", (col) => col.defaultTo(null))
        .execute();
      console.log("✅ Added displayComponent column to notification table");
    } catch (error) {
      if (error.message?.includes("duplicate column") || error.message?.includes("already exists")) {
        console.log("ℹ️  displayComponent column already exists in notification table");
      } else {
        console.log("⚠️  Could not add displayComponent column:", error.message);
      }
    }

    // Add previewTitle column to existing notification table if it doesn't exist
    try {
      await db.schema
        .alterTable("notification")
        .addColumn("previewTitle", "text", (col) => col.defaultTo(null))
        .execute();
      console.log("✅ Added previewTitle column to notification table");
    } catch (error) {
      if (error.message?.includes("duplicate column") || error.message?.includes("already exists")) {
        console.log("ℹ️  previewTitle column already exists in notification table");
      } else {
        console.log("⚠️  Could not add previewTitle column:", error.message);
      }
    }

    // Add priority column to existing notification table if it doesn't exist
    try {
      await db.schema
        .alterTable("notification")
        .addColumn("priority", "text", (col) => col.defaultTo("false"))
        .execute();
      console.log("✅ Added priority column to notification table");
    } catch (error) {
      if (error.message?.includes("duplicate column") || error.message?.includes("already exists")) {
        console.log("ℹ️  priority column already exists in notification table");
      } else {
        console.log("⚠️  Could not add priority column:", error.message);
      }
    }

    // Add index on userId for notification table
    await db.schema
      .createIndex("notification_userId_idx")
      .ifNotExists()
      .on("notification")
      .column("userId")
      .execute();
    console.log("✅ Notification userId index created");

    // Enable WAL replication for notification table
    await sql`ALTER TABLE notification REPLICA IDENTITY FULL`.execute(db);
    console.log("✅ Enabled replica identity for notification table");

    // Create or update publication with current tables
    try {
      // Try to create publication
      await sql`CREATE PUBLICATION zero_data FOR TABLE project, cup, "cupMatch", "userIdentities", "identityPurchase", vote, notification`.execute(
        db
      );
      console.log("✅ Created publication for Zero");
    } catch (error) {
      if (error.message?.includes("already exists")) {
        // Publication exists, ensure current tables are included
        // Check which tables are already in the publication before adding
        const publicationTables = await sql`
          SELECT tablename FROM pg_publication_tables 
          WHERE pubname = 'zero_data'
        `.execute(db);

        const existingTables = new Set(
          publicationTables.rows.map((row) => row.tablename.toLowerCase())
        );

        const tablesToAdd = [
          { name: "project", quoted: false },
          { name: "cup", quoted: false },
          { name: "cupMatch", quoted: true },
          { name: "userIdentities", quoted: true },
          { name: "identityPurchase", quoted: true },
          { name: "vote", quoted: false },
          { name: "notification", quoted: false },
        ];

        for (const table of tablesToAdd) {
          const tableName = table.quoted ? `"${table.name}"` : table.name;

          // Check if table is already in publication (case-insensitive comparison)
          if (existingTables.has(table.name.toLowerCase())) {
            console.log(`ℹ️  ${table.name} already in publication (skipping)`);
            continue;
          }

          try {
            await sql
              .raw(`ALTER PUBLICATION zero_data ADD TABLE ${tableName}`)
              .execute(db);
            console.log(`✅ Added ${table.name} to publication`);
          } catch (addError) {
            if (
              addError.message?.includes("already exists") ||
              addError.message?.includes("is already a member")
            ) {
              console.log(`ℹ️  ${table.name} already in publication`);
            } else {
              console.log(
                `⚠️  Could not add ${table.name} to publication:`,
                addError.message
              );
            }
          }
        }
      } else {
        throw error;
      }
    }

    // Final verification: Check publication contents
    console.log("\n📋 Verifying publication configuration...");
    const finalPublicationTables = await sql`
      SELECT tablename FROM pg_publication_tables 
      WHERE pubname = 'zero_data'
      ORDER BY tablename
    `.execute(db);
    console.log("✅ Tables in zero_data publication:");
    finalPublicationTables.rows.forEach((row) => {
      console.log(`   - ${row.tablename}`);
    });

    // Verify identityPurchase table exists and has correct columns
    const identityPurchaseCheck = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'identityPurchase'
      ORDER BY ordinal_position
    `.execute(db);
    if (identityPurchaseCheck.rows.length > 0) {
      console.log("\n✅ identityPurchase table columns:");
      identityPurchaseCheck.rows.forEach((row) => {
        console.log(`   - ${row.column_name} (${row.data_type})`);
      });
    } else {
      console.log("\n⚠️  WARNING: identityPurchase table not found!");
    }

    // Verify userIdentities.cupId column exists
    const cupIdCheck = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'userIdentities' AND column_name = 'cupId'
    `.execute(db);
    if (cupIdCheck.rows.length > 0) {
      console.log("\n✅ userIdentities.cupId column exists");
    } else {
      console.log("\n⚠️  WARNING: userIdentities.cupId column not found!");
    }

    // Verify notification table exists and has correct columns
    const notificationCheck = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'notification'
      ORDER BY ordinal_position
    `.execute(db);
    if (notificationCheck.rows.length > 0) {
      console.log("\n✅ notification table columns:");
      notificationCheck.rows.forEach((row) => {
        console.log(`   - ${row.column_name} (${row.data_type})`);
      });
    } else {
      console.log("\n⚠️  WARNING: notification table not found!");
    }

    console.log("\n🎉 Zero database migration completed successfully!");
    console.log(
      "\n⚠️  IMPORTANT: Restart your Zero cache server to pick up schema changes!"
    );
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }
}

createTables()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
