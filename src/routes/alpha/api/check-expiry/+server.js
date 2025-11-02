import { json } from "@sveltejs/kit";
import { zeroDb } from "$lib/db.server.js";
import { checkAndCloseExpired } from "$lib/expiry-checker.server.js";

/**
 * API endpoint to check and close expired matches/cups
 * Can be called from frontend listeners to ensure expired items are closed
 * Accepts optional cupId to check specific cup, or checks all if not provided
 */
export async function POST({ request }) {
  try {
    const { cupId } = await request.json().catch(() => ({}));

    let matches = [];
    let cups = [];

    if (cupId) {
      // Check specific cup and its matches
      const cup = await zeroDb
        .selectFrom("cup")
        .selectAll()
        .where("id", "=", cupId)
        .executeTakeFirst();

      if (cup) {
        cups = [cup];
        // Get all matches for this cup
        matches = await zeroDb
          .selectFrom("cupMatch")
          .selectAll()
          .where("cupId", "=", cupId)
          .execute();
      }
    } else {
      // Check all active cups and matches
      cups = await zeroDb
        .selectFrom("cup")
        .selectAll()
        .where("status", "=", "active")
        .execute();

      // Get all non-completed matches
      matches = await zeroDb
        .selectFrom("cupMatch")
        .selectAll()
        .where("status", "!=", "completed")
        .execute();
    }

    // Check and close expired items
    const { matchesClosed, cupsClosed } = await checkAndCloseExpired(matches, cups);

    return json({
      success: true,
      matchesClosed,
      cupsClosed,
      message: `Checked expiry: ${matchesClosed} matches and ${cupsClosed} cups closed.`,
    });
  } catch (error) {
    console.error("Check expiry error:", error);
    return json(
      {
        error: "Failed to check expiry",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for quick expiry check (no auth required, safe to call)
 */
export async function GET({ url }) {
  try {
    const cupId = url.searchParams.get("cupId");

    let matches = [];
    let cups = [];

    if (cupId) {
      // Check specific cup and its matches
      const cup = await zeroDb
        .selectFrom("cup")
        .selectAll()
        .where("id", "=", cupId)
        .executeTakeFirst();

      if (cup) {
        cups = [cup];
        matches = await zeroDb
          .selectFrom("cupMatch")
          .selectAll()
          .where("cupId", "=", cupId)
          .execute();
      }
    } else {
      // Check all active cups and matches
      cups = await zeroDb
        .selectFrom("cup")
        .selectAll()
        .where("status", "=", "active")
        .execute();

      matches = await zeroDb
        .selectFrom("cupMatch")
        .selectAll()
        .where("status", "!=", "completed")
        .execute();
    }

    const { matchesClosed, cupsClosed } = await checkAndCloseExpired(matches, cups);

    return json({
      success: true,
      matchesClosed,
      cupsClosed,
    });
  } catch (error) {
    console.error("Check expiry error:", error);
    return json({ error: "Failed to check expiry" }, { status: 500 });
  }
}

