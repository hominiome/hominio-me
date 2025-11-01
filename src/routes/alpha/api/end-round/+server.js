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

    // Check if any matches don't have winners yet
    const matchesWithoutWinners = currentMatches.filter((m) => !m.winnerId);
    if (matchesWithoutWinners.length > 0) {
      return json(
        {
          error: `Cannot end round: ${matchesWithoutWinners.length} match(es) don't have winners yet. Use individual "Determine Winner" buttons first.`,
        },
        { status: 400 }
      );
    }

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

    // Collect winners (they're already determined)
    const winners = [];

    for (const match of currentMatches) {
      winners.push({
        matchId: match.id,
        winnerId: match.winnerId,
        position: match.position,
      });
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

          // Create wallets for this match
          const wallet1Id = nanoid();
          const wallet2Id = nanoid();

          await zeroDb
            .insertInto("wallet")
            .values([
              {
                id: wallet1Id,
                entityType: "match",
                entityId: `${matchId}-p1`,
                balance: 0,
                createdAt: now,
                updatedAt: now,
              },
              {
                id: wallet2Id,
                entityType: "match",
                entityId: `${matchId}-p2`,
                balance: 0,
                createdAt: now,
                updatedAt: now,
              },
            ])
            .execute();

          // Create next round match
          await zeroDb
            .insertInto("cupMatch")
            .values({
              id: matchId,
              cupId,
              round: nextRound,
              position: Math.floor(i / 2), // New position in next round
              project1Id: winner1.winnerId,
              project2Id: winner2.winnerId,
              project1WalletId: wallet1Id,
              project2WalletId: wallet2Id,
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
