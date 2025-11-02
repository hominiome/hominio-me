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

    // Calculate new vote totals for both project sides
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

    const project1Votes = Number(votes1Result?.total || 0);
    const project2Votes = Number(votes2Result?.total || 0);
    const newTotal = projectSide === "project1" ? project1Votes : project2Votes;

    // Get both projects to notify their owners
    const project1 = await zeroDb
      .selectFrom("project")
      .select(["userId"])
      .where("id", "=", match.project1Id)
      .executeTakeFirst();

    const project2 = await zeroDb
      .selectFrom("project")
      .select(["userId"])
      .where("id", "=", match.project2Id)
      .executeTakeFirst();

    // Motivating messages - 10 alternating messages
    const aheadMessages = [
      "Keep pushing forward! Your supporters believe in you.",
      "You're leading the way—don't slow down now!",
      "Momentum is on your side. Ride this wave!",
      "Every vote counts—you're building something special!",
      "The community sees your vision. Keep going!",
      "You're in the lead! Channel this energy forward.",
      "Your project is resonating. Stay focused!",
      "Support is pouring in. Harness this power!",
      "You're winning hearts and minds. Push harder!",
      "The finish line is in sight. Don't let up!"
    ];

    const behindMessages = [
      "Every comeback starts with a single step. Keep fighting!",
      "The race isn't over yet. Rally your supporters!",
      "You've got this! Turn the tide with determination.",
      "Behind today, ahead tomorrow. Stay focused!",
      "Your supporters need you now more than ever.",
      "This is your moment to shine. Don't give up!",
      "Great stories are written in moments like this. Push forward!",
      "The best victories come from behind. Keep going!",
      "You're building something bigger than numbers. Stay strong!",
      "Momentum can shift in an instant. Believe!"
    ];

    // Create notifications for both project owners (if they exist and aren't the voter)
    const getRandomMessage = (messages) => messages[Math.floor(Math.random() * messages.length)];

    // Notify project1 owner
    if (project1 && project1.userId !== userId) {
      const isProject1Ahead = project1Votes > project2Votes;
      const isProject1Behind = project1Votes < project2Votes;
      const message = isProject1Ahead 
        ? getRandomMessage(aheadMessages)
        : isProject1Behind 
        ? getRandomMessage(behindMessages)
        : "The match is tied! Keep fighting for every vote.";

      const notificationId = nanoid();
      // Store matchId, projectSide, and votingWeight received in resourceId as "matchId|projectSide|votingWeight"
      // votingWeight is the weight added in THIS event (positive if voted for, negative if voted against)
      const votesReceived = projectSide === "project1" ? votingWeight : -votingWeight;
      await zeroDb
        .insertInto("notification")
        .values({
          id: notificationId,
          userId: project1.userId,
          resourceType: "vote",
          resourceId: `${matchId}|project1|${votesReceived}`,
          title: "Someone voted on your match",
          message: message,
          read: "false",
          createdAt: now,
          actions: JSON.stringify([
            { label: "View Match", url: `/alpha/cups/${match.cupId}` }
          ]),
          sound: "/voting-effect.mp3",
          icon: projectSide === "project1" ? "mdi:thumb-up" : "mdi:thumb-down",
          displayComponent: "VotingProgressDisplay",
        })
        .execute();
    }

    // Notify project2 owner
    if (project2 && project2.userId !== userId) {
      const isProject2Ahead = project2Votes > project1Votes;
      const isProject2Behind = project2Votes < project1Votes;
      const message = isProject2Ahead 
        ? getRandomMessage(aheadMessages)
        : isProject2Behind 
        ? getRandomMessage(behindMessages)
        : "The match is tied! Keep fighting for every vote.";

      const notificationId = nanoid();
      // Store matchId, projectSide, and votingWeight received in resourceId as "matchId|projectSide|votingWeight"
      // votingWeight is the weight added in THIS event (positive if voted for, negative if voted against)
      const votesReceived = projectSide === "project2" ? votingWeight : -votingWeight;
      await zeroDb
        .insertInto("notification")
        .values({
          id: notificationId,
          userId: project2.userId,
          resourceType: "vote",
          resourceId: `${matchId}|project2|${votesReceived}`,
          title: "Someone voted on your match",
          message: message,
          read: "false",
          createdAt: now,
          actions: JSON.stringify([
            { label: "View Match", url: `/alpha/cups/${match.cupId}` }
          ]),
          sound: "/voting-effect.mp3",
          icon: projectSide === "project2" ? "mdi:thumb-up" : "mdi:thumb-down",
          displayComponent: "VotingProgressDisplay",
        })
        .execute();
    }

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

