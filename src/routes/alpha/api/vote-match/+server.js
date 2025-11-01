import { json } from "@sveltejs/kit";
import { nanoid } from "nanoid";
import { getSession } from "$lib/api-helpers.server.js";
import { zeroDb } from "$lib/db.server.js";

export async function POST({ request }) {
  // Get session
  const session = await getSession(request);

  if (!session?.user?.id) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const { matchId, projectSide } = await request.json();

  if (!matchId || !projectSide) {
    return json({ error: "Invalid parameters" }, { status: 400 });
  }

  if (projectSide !== "project1" && projectSide !== "project2") {
    return json({ error: "Invalid project side" }, { status: 400 });
  }

  const userId = session.user.id;
  const now = new Date().toISOString();

  try {
    // Get match to find cupId
    const match = await zeroDb
      .selectFrom("cupMatch")
      .selectAll()
      .where("id", "=", matchId)
      .executeTakeFirst();

    if (!match) {
      return json({ error: "Match not found" }, { status: 404 });
    }

    // Check if user has an identity for this specific cup
    const userIdentity = await zeroDb
      .selectFrom("userIdentities")
      .selectAll()
      .where("userId", "=", userId)
      .where("cupId", "=", match.cupId)
      .executeTakeFirst();

    if (!userIdentity) {
      return json(
        {
          error: "You need to purchase a voting identity for this cup before you can vote. Please visit the purchase page.",
        },
        { status: 400 }
      );
    }

    // Check if user already voted on this match
    const existingVote = await zeroDb
      .selectFrom("vote")
      .selectAll()
      .where("userId", "=", userId)
      .where("matchId", "=", matchId)
      .executeTakeFirst();

    if (existingVote) {
      return json(
        {
          error: "You have already voted on this match. Each user can vote once per match.",
        },
        { status: 400 }
      );
    }

    // Get the project being voted on and check ownership
    const projectId =
      projectSide === "project1" ? match.project1Id : match.project2Id;
    const project = await zeroDb
      .selectFrom("project")
      .select(["userId"])
      .where("id", "=", projectId)
      .executeTakeFirst();

    if (project && project.userId === userId) {
      return json(
        { error: "You cannot vote for your own project" },
        { status: 403 }
      );
    }

    const votingWeight = userIdentity.votingWeight;

    // Create vote record (immutable)
    await zeroDb
      .insertInto("vote")
      .values({
        id: nanoid(),
        userId,
          matchId,
          projectSide,
        votingWeight,
        createdAt: now,
      })
      .execute();

    // Calculate new vote total for the project side
    const voteTotal = await zeroDb
      .selectFrom("vote")
      .select(({ fn }) => [
        fn.sum("votingWeight").as("total"),
      ])
      .where("matchId", "=", matchId)
      .where("projectSide", "=", projectSide)
      .executeTakeFirst();

    const newTotal = Number(voteTotal?.total || 0);

    return json({
      success: true,
      newTotal,
      voted: votingWeight,
      votingWeight,
    });
  } catch (error) {
    console.error("Vote match error:", error);
    
    // Check if error is due to unique constraint violation (duplicate vote)
    if (error.message?.includes("unique") || error.message?.includes("duplicate")) {
      return json(
        {
          error: "You have already voted on this match. Each user can vote once per match.",
        },
        { status: 400 }
      );
    }
    
    return json({ error: "Vote failed" }, { status: 500 });
  }
}

