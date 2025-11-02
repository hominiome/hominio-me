import { json } from "@sveltejs/kit";
import { zeroDb } from "$lib/db.server.js";
import { checkAndCloseExpiredMatches } from "$lib/expiry-checker.server.js";

export async function GET({ params }) {
  const { matchId } = params;

  if (!matchId) {
    return json({ error: "Match ID is required" }, { status: 400 });
  }

  try {
    // Get match details
    const match = await zeroDb
      .selectFrom("cupMatch")
      .selectAll()
      .where("id", "=", matchId)
      .executeTakeFirst();

    if (!match) {
      return json({ error: "Match not found" }, { status: 404 });
    }

    // Check if match has expired and close it if needed
    // Get all matches in the same round to check round-level endDate
    const roundMatches = await zeroDb
      .selectFrom("cupMatch")
      .selectAll()
      .where("cupId", "=", match.cupId)
      .where("round", "=", match.round)
      .execute();
    
    await checkAndCloseExpiredMatches([match, ...roundMatches]);
    
    // Re-fetch match in case it was just closed
    const updatedMatch = await zeroDb
      .selectFrom("cupMatch")
      .selectAll()
      .where("id", "=", matchId)
      .executeTakeFirst();

    // Get both projects
    const project1 = await zeroDb
      .selectFrom("project")
      .selectAll()
      .where("id", "=", updatedMatch.project1Id)
      .executeTakeFirst();

    const project2 = await zeroDb
      .selectFrom("project")
      .selectAll()
      .where("id", "=", updatedMatch.project2Id)
      .executeTakeFirst();

    return json({
      match: updatedMatch,
      project1,
      project2,
    });
  } catch (error) {
    console.error("Failed to fetch match details:", error);
    return json({ error: "Failed to fetch match details" }, { status: 500 });
  }
}

