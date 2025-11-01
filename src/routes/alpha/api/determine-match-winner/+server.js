import { json } from "@sveltejs/kit";
import { requireAdmin } from "$lib/api-helpers.server.js";
import { zeroDb } from "$lib/db.server.js";

export async function POST({ request }) {
  // Require admin access (throws 401/403 if not authenticated/admin)
  await requireAdmin(request);

  const { matchId } = await request.json();

  if (!matchId) {
    return json({ error: "Match ID is required" }, { status: 400 });
  }

  const now = new Date().toISOString();

  try {
    // Get match
    const match = await zeroDb
      .selectFrom("cupMatch")
      .selectAll()
      .where("id", "=", matchId)
      .executeTakeFirst();

    if (!match) {
      return json({ error: "Match not found" }, { status: 404 });
    }

    // Get cup
    const cup = await zeroDb
      .selectFrom("cup")
      .selectAll()
      .where("id", "=", match.cupId)
      .executeTakeFirst();

    if (!cup) {
      return json({ error: "Cup not found" }, { status: 404 });
    }

    if (match.winnerId) {
      return json(
        { error: "Winner already determined for this match" },
        { status: 400 }
      );
    }

    // Get vote counts from vote table
    const votes1Result = await zeroDb
      .selectFrom("vote")
      .select(({ fn }) => [
        fn.sum("votingWeight").as("total"),
      ])
      .where("matchId", "=", matchId)
      .where("projectSide", "=", "project1")
      .executeTakeFirst();

    const votes2Result = await zeroDb
      .selectFrom("vote")
      .select(({ fn }) => [
        fn.sum("votingWeight").as("total"),
      ])
      .where("matchId", "=", matchId)
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
      .where("id", "=", matchId)
      .execute();

    return json({
      success: true,
      winnerId,
      votes1,
      votes2,
      message: `Winner determined! ${votes1} vs ${votes2} votes`,
    });
  } catch (error) {
    console.error("Determine winner error:", error);
    return json({ error: "Failed to determine winner" }, { status: 500 });
  }
}

