import { json } from "@sveltejs/kit";
import { requireAdmin } from "$lib/api-helpers.server.js";
import { zeroDb } from "$lib/db.server.js";
import { checkAndCloseExpired } from "$lib/expiry-checker.server.js";

export async function POST({ request }) {
  // Require admin access (throws 401/403 if not authenticated/admin)
  await requireAdmin(request);

  const { cupId } = await request.json();

  if (!cupId) {
    return json({ error: "Cup ID is required" }, { status: 400 });
  }

  const now = new Date().toISOString();

  try {
    // Get cup
    const cup = await zeroDb
      .selectFrom("cup")
      .selectAll()
      .where("id", "=", cupId)
      .executeTakeFirst();

    if (!cup) {
      return json({ error: "Cup not found" }, { status: 404 });
    }

    // Check if cup or matches have expired before processing
    const currentRound = cup.currentRound;
    const currentMatches = await zeroDb
      .selectFrom("cupMatch")
      .selectAll()
      .where("cupId", "=", cupId)
      .where("round", "=", currentRound)
      .execute();

    await checkAndCloseExpired(currentMatches, [cup]);
    
    // Re-fetch cup in case it was just closed
    const updatedCup = await zeroDb
      .selectFrom("cup")
      .selectAll()
      .where("id", "=", cupId)
      .executeTakeFirst();

    if (updatedCup.status !== "active") {
      return json({ error: "Cup is not active" }, { status: 400 });
    }

    // Re-fetch matches in case any were closed
    const updatedMatches = await zeroDb
      .selectFrom("cupMatch")
      .selectAll()
      .where("cupId", "=", cupId)
      .where("round", "=", currentRound)
      .execute();

    if (updatedMatches.length === 0) {
      return json(
        { error: "No matches found in current round" },
        { status: 400 }
      );
    }

    // Automatically determine winners for matches that don't have winners yet
    const matchesWithoutWinners = updatedMatches.filter((m) => !m.winnerId);

    for (const match of matchesWithoutWinners) {
      // Get vote counts from vote table
      const votes1Result = await zeroDb
        .selectFrom("vote")
        .select(({ fn }) => [fn.sum("votingWeight").as("total")])
        .where("matchId", "=", match.id)
        .where("projectSide", "=", "project1")
        .executeTakeFirst();

      const votes2Result = await zeroDb
        .selectFrom("vote")
        .select(({ fn }) => [fn.sum("votingWeight").as("total")])
        .where("matchId", "=", match.id)
        .where("projectSide", "=", "project2")
        .executeTakeFirst();

      const votes1 = Number(votes1Result?.total || 0);
      const votes2 = Number(votes2Result?.total || 0);

      let winnerId = "";
      if (votes1 > votes2) {
        winnerId = match.project1Id;
      } else if (votes2 > votes1) {
        winnerId = match.project2Id;
      } else {
        // In case of tie, pick project with higher ID (consistent tiebreaker)
        winnerId =
          match.project1Id > match.project2Id
            ? match.project1Id
            : match.project2Id;
      }

      // Update match with winner
      await zeroDb
        .updateTable("cupMatch")
        .set({
          winnerId,
          status: "completed",
          completedAt: now,
        })
        .where("id", "=", match.id)
        .execute();
    }

    // Re-fetch all matches in current round to get updated winners (after determining winners)
    const finalMatches = await zeroDb
      .selectFrom("cupMatch")
      .selectAll()
      .where("cupId", "=", cupId)
      .where("round", "=", currentRound)
      .execute();

    // Count winners
    const winnersCount = finalMatches.filter((m) => m.winnerId).length;

    // Check if this is the final round
    const isFinalRound = currentRound === "final";

    if (isFinalRound) {
      // Final round completed, mark cup as completed
      const finalWinner = finalMatches.find((m) => m.winnerId);
      await zeroDb
        .updateTable("cup")
        .set({
          status: "completed",
          winnerId: finalWinner?.winnerId || "",
          completedAt: now,
          updatedAt: now,
        })
        .where("id", "=", cupId)
        .execute();
    }

    return json({
      success: true,
      winnersCount,
      message: isFinalRound
        ? `Cup completed! Winner determined.`
        : `Round completed! ${winnersCount} winners determined. Use "Start Next Round" to advance.`,
    });
  } catch (error) {
    console.error("End round error:", error);
    // If error is already a JSON response (from requireAdmin), re-throw it
    if (error && typeof error === "object" && "status" in error) {
      throw error;
    }
    return json(
      {
        error: error instanceof Error ? error.message : "Failed to end round",
        details: error instanceof Error ? error.toString() : String(error),
      },
      { status: 500 }
    );
  }
}
