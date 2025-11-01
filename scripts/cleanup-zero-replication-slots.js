#!/usr/bin/env bun
/**
 * Script to clean up stale Zero replication slots
 * Run this if you're experiencing replication slot conflicts
 */

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.SECRET_ZERO_DEV_PG;

if (!DATABASE_URL) {
  console.error("❌ SECRET_ZERO_DEV_PG environment variable is required");
  process.exit(1);
}

async function cleanupReplicationSlots() {
  console.log("🧹 Cleaning up stale Zero replication slots...\n");

  const db = neon(DATABASE_URL);

  try {
    // List all replication slots
    const slots = await db`
      SELECT 
        slot_name,
        slot_type,
        active,
        pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) as lag_size
      FROM pg_replication_slots
      WHERE slot_name LIKE 'zero_%'
      ORDER BY slot_name
    `;

    console.log(`Found ${slots.length} Zero replication slot(s):\n`);

    if (slots.length === 0) {
      console.log("✅ No Zero replication slots found. Nothing to clean up.");
      return;
    }

    // Display all slots
    for (const slot of slots) {
      const status = slot.active ? "🟢 ACTIVE" : "🔴 INACTIVE";
      console.log(`  ${status} ${slot.slot_name}`);
      console.log(`     Type: ${slot.slot_type}, Lag: ${slot.lag_size || "N/A"}`);
    }

    // Count inactive slots
    const inactiveSlots = slots.filter(s => !s.active);
    
    if (inactiveSlots.length === 0) {
      console.log("\n✅ All replication slots are active. No cleanup needed.");
      return;
    }

    console.log(`\n⚠️  Found ${inactiveSlots.length} inactive slot(s).`);
    console.log("These slots can cause conflicts when Zero restarts.\n");

    // Drop inactive slots
    for (const slot of inactiveSlots) {
      try {
        console.log(`🗑️  Dropping inactive slot: ${slot.slot_name}...`);
        await db`SELECT pg_drop_replication_slot(${slot.slot_name})`;
        console.log(`   ✅ Dropped ${slot.slot_name}`);
      } catch (error) {
        console.error(`   ❌ Failed to drop ${slot.slot_name}:`, error.message);
      }
    }

    console.log("\n✅ Cleanup complete!");
    console.log("\n💡 Next steps:");
    console.log("   1. Restart your Zero sync service");
    console.log("   2. Zero will create a fresh replication slot");
    console.log("   3. Monitor logs to ensure no conflicts");

  } catch (error) {
    console.error("❌ Error cleaning up replication slots:", error);
    throw error;
  }
}

cleanupReplicationSlots()
  .then(() => {
    console.log("\n🎉 Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Failed:", error);
    process.exit(1);
  });
