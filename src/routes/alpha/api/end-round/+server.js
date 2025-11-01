import { json } from "@sveltejs/kit";
import { nanoid } from "nanoid";
import { requireAdmin } from "$lib/api-helpers.server.js";
import { zeroDb } from "$lib/db.server.js";

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

    if (cup.status !== "active") {
      return json({ error: "Cup is not active" }, { status: 400 });
    }

    const currentRound = cup.currentRound;

    // Get all matches in current round
    const currentMatches = await zeroDb
      .selectFrom("cupMatch")
      .selectAll()
      .where("cupId", "=", cupId)
      .where("round", "=", currentRound)
      .execute();

    if (currentMatches.length === 0) {
      return json(
        { error: "No matches found in current round" },
        { status: 400 }
      );
    }

    // Automatically determine winners for matches that don't have winners yet
    const matchesWithoutWinners = currentMatches.filter((m) => !m.winnerId);
    
    for (const match of matchesWithoutWinners) {
      // Get vote counts from vote table
      const votes1Result = await zeroDb
        .selectFrom("vote")
        .select(({ fn }) => [
          fn.sum("votingWeight").as("total"),
        ])
        .where("matchId", "=", match.id)
        .where("projectSide", "=", "project1")
        .executeTakeFirst();

      const votes2Result = await zeroDb
        .selectFrom("vote")
        .select(({ fn }) => [
          fn.sum("votingWeight").as("total"),
        ])
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

    // Re-fetch all matches in current round to get updated winners
    const updatedMatches = await zeroDb
      .selectFrom("cupMatch")
      .selectAll()
      .where("cupId", "=", cupId)
      .where("round", "=", currentRound)
      .execute();

    // Check if next round already exists
    let nextRound = null;
    if (currentRound === "round_16") {
      nextRound = "quarter";
    } else if (currentRound === "quarter") {
      nextRound = "semi";
    } else if (currentRound === "semi") {
      nextRound = "final";
    } else if (currentRound === "final") {
      nextRound = null;
    }

    if (nextRound) {
      const existingNextRoundMatches = await zeroDb
        .selectFrom("cupMatch")
        .selectAll()
        .where("cupId", "=", cupId)
        .where("round", "=", nextRound)
        .execute();

      if (existingNextRoundMatches.length > 0) {
        return json(
          {
            error: "Next round already exists! Cannot advance again.",
          },
          { status: 400 }
        );
      }
    }

    // Collect winners from updated matches
    const winners = [];

    for (const match of updatedMatches) {
      if (!match.winnerId) {
        // Skip matches without winners (shouldn't happen, but safety check)
        console.warn(`Match ${match.id} doesn't have a winner after auto-determination`);
        continue;
      }
      winners.push({
        matchId: match.id,
        winnerId: match.winnerId,
        position: match.position,
      });
    }

    // Ensure we have an even number of winners for pairing
    if (winners.length % 2 !== 0) {
      return json(
        {
          error: `Cannot advance: Expected even number of winners, got ${winners.length}. Some matches may be missing winners.`,
        },
        { status: 400 }
      );
    }

    if (nextRound) {
      // Create next round matches
      // Pair winners: position 0+1, 2+3, 4+5, 6+7 for quarters
      // Pair winners: position 0+1, 2+3 for semis
      // Pair winners: position 0+1 for final

      const sortedWinners = winners.sort((a, b) => a.position - b.position);

      for (let i = 0; i < sortedWinners.length; i += 2) {
        const winner1 = sortedWinners[i];
        const winner2 = sortedWinners[i + 1];

        if (winner1 && winner2) {
          const matchId = nanoid();

          // Create next round match (no wallets needed - votes tracked in vote table)
          await zeroDb
            .insertInto("cupMatch")
            .values({
              id: matchId,
              cupId,
              round: nextRound,
              position: Math.floor(i / 2), // New position in next round
              project1Id: winner1.winnerId,
              project2Id: winner2.winnerId,
              winnerId: "",
              status: "voting",
              completedAt: "",
            })
            .execute();
        }
      }

      // Update cup to next round
      await zeroDb
        .updateTable("cup")
        .set({
          currentRound: nextRound,
          updatedAt: now,
        })
        .where("id", "=", cupId)
        .execute();

      // Update all matches in the next round from "pending" to "voting"
      await zeroDb
        .updateTable("cupMatch")
        .set({
          status: "voting",
        })
        .where("cupId", "=", cupId)
        .where("round", "=", nextRound)
        .where("status", "=", "pending")
        .execute();
    } else {
      // Final round completed, mark cup as completed
      await zeroDb
        .updateTable("cup")
        .set({
          status: "completed",
          winnerId: winners[0]?.winnerId || "",
          completedAt: now,
          updatedAt: now,
        })
        .where("id", "=", cupId)
        .execute();
    }

    return json({
      success: true,
      winnersCount: winners.length,
      nextRound: nextRound || "completed",
      message: nextRound
        ? `Round completed! ${winners.length} winners advanced to ${nextRound}.`
        : `Cup completed! Winner: ${winners[0]?.winnerId}`,
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
