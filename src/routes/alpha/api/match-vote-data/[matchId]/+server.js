import { json } from "@sveltejs/kit";
import { zeroDb } from "$lib/db.server.js";

export async function GET({ params }) {
  const { matchId } = params;

  if (!matchId) {
    return json({ error: "Match ID is required" }, { status: 400 });
  }

  try {
    // Calculate vote totals for both project sides
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

    const project1 = Number(votes1Result?.total || 0);
    const project2 = Number(votes2Result?.total || 0);

    return json({
      project1,
      project2,
    });
  } catch (error) {
    console.error("Failed to fetch match vote data:", error);
    return json({ error: "Failed to fetch vote data" }, { status: 500 });
  }
}

