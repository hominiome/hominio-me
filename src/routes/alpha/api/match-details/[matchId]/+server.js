import { json } from "@sveltejs/kit";
import { zeroDb } from "$lib/db.server.js";

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

    // Get both projects
    const project1 = await zeroDb
      .selectFrom("project")
      .selectAll()
      .where("id", "=", match.project1Id)
      .executeTakeFirst();

    const project2 = await zeroDb
      .selectFrom("project")
      .selectAll()
      .where("id", "=", match.project2Id)
      .executeTakeFirst();

    return json({
      match,
      project1,
      project2,
    });
  } catch (error) {
    console.error("Failed to fetch match details:", error);
    return json({ error: "Failed to fetch match details" }, { status: 500 });
  }
}

