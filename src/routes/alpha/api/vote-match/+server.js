import { json } from "@sveltejs/kit";
import { nanoid } from "nanoid";
import { getSession, requireExplorerIdentity } from "$lib/api-helpers.server.js";
import { zeroDb } from "$lib/db.server.js";
import { getNotificationConfig } from "$lib/notification-helpers.server.js";
import { getMatchEndDate } from "$lib/dateUtils.js";

export async function POST({ request }) {
  // Require explorer identity
  await requireExplorerIdentity(request);
  
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
  const nowDate = new Date();

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

    // Check if match is already completed
    if (match.status === "completed") {
      return json(
        {
          error: "This match has already ended. Voting is closed.",
        },
        { status: 400 }
      );
    }

    // Get all matches in the same round to determine end date (fallback logic)
    const roundMatches = await zeroDb
      .selectFrom("cupMatch")
      .selectAll()
      .where("cupId", "=", match.cupId)
      .where("round", "=", match.round)
      .execute();

    // Get the effective end date for this match (match-specific or round-level)
    const matchEndDate = getMatchEndDate(match, roundMatches);

    // Check if voting has ended
    if (matchEndDate) {
      const endDate = new Date(matchEndDate);
      if (nowDate >= endDate) {
        // Time is over - determine if this is a match-specific or round-level endDate
        const isMatchSpecific = !!match.endDate;
        
        if (isMatchSpecific) {
          // Match has its own endDate - only close this match
          await zeroDb
            .updateTable("cupMatch")
            .set({
              status: "completed",
              completedAt: now,
            })
            .where("id", "=", matchId)
            .execute();
        } else {
          // Round-level endDate - close all matches in this round that aren't already completed
          const matchesToClose = roundMatches.filter((m) => m.status !== "completed");
          for (const matchToClose of matchesToClose) {
            await zeroDb
              .updateTable("cupMatch")
              .set({
                status: "completed",
                completedAt: now,
              })
              .where("id", "=", matchToClose.id)
              .execute();
          }
        }

        return json(
          {
            error: "Voting for this match has ended. The match is now closed.",
          },
          { status: 400 }
        );
      }
    }

    // Check if user has an identity for this cup
    // Check for cup-specific identity first, then universal identity (cupId IS NULL)
    let userIdentity = await zeroDb
      .selectFrom("userIdentities")
      .selectAll()
      .where("userId", "=", userId)
      .where("cupId", "=", match.cupId)
      .executeTakeFirst();

    // If no cup-specific identity, check for universal identity
    if (!userIdentity) {
      userIdentity = await zeroDb
        .selectFrom("userIdentities")
        .selectAll()
        .where("userId", "=", userId)
        .where("cupId", "is", null)
        .where("identityType", "=", "hominio")
        .executeTakeFirst();
    }

    if (!userIdentity) {
      return json(
        {
          error: "You need a voting identity to vote. Purchase '❤︎ I am Hominio' membership for unlimited voting access to all cups.",
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

    // Messages when THEY got a vote (encouraging/celebratory)
    const receivedVoteMessages = [
      "Awesome! Someone just voted for you. Keep the momentum going!",
      "Great news! Your support is growing. Share your project with more people!",
      "Another vote in your favor! Your vision is resonating with voters.",
      "You're gaining ground! Keep spreading the word about your project.",
      "Your supporters are showing up! This is your moment to shine.",
      "Every vote brings you closer. Keep pushing forward!",
      "Someone believes in your project! Keep sharing your story.",
      "Your message is reaching people. Don't stop now!",
      "Another supporter joined your cause. Rally your community!",
      "You're building momentum! Every vote matters—keep going!"
    ];

    // Messages when OPPONENT got a vote (motivational/rallying)
    const opponentReceivedVoteMessages = [
      "Your opponent got a vote, but you're still in this! Rally your supporters!",
      "The competition is heating up. Now's the time to push harder!",
      "They got a vote, but don't let up! Your supporters are counting on you.",
      "This is when champions step up. Share your project and fight back!",
      "The race isn't over yet. Your community needs to see why you deserve to win!",
      "They're gaining ground—turn this into motivation! Reach out to your network.",
      "Every match has its momentum shifts. This is your chance to respond!",
      "Your supporters are waiting to see you fight. Show them your determination!",
      "Don't let this slow you down. Great comebacks start with moments like this!",
      "The best victories come from behind. Rally your community and push forward!"
    ];

    // Create notifications for both project owners (if they exist and aren't the voter)
    const getRandomMessage = (messages) => messages[Math.floor(Math.random() * messages.length)];

    // Notify project1 owner
    if (project1 && project1.userId !== userId) {
      const notificationId = nanoid();
      // Store matchId, projectSide, and votingWeight received in resourceId as "matchId|projectSide|votingWeight"
      // votingWeight is the weight added in THIS event (positive if voted for, negative if voted against)
      const votesReceived = projectSide === "project1" ? votingWeight : -votingWeight;
      
      // Determine if project1 got the vote or opponent got it
      const project1GotVote = projectSide === "project1";
      const notificationSubtype = project1GotVote ? "received" : "opponentReceived";
      const message = project1GotVote 
        ? getRandomMessage(receivedVoteMessages)
        : getRandomMessage(opponentReceivedVoteMessages);
      
      const notificationConfig = getNotificationConfig("vote", notificationSubtype, {
        message,
        cupId: match.cupId,
        matchId: matchId,
      });
      
      await zeroDb
        .insertInto("notification")
        .values({
          id: notificationId,
          userId: project1.userId,
          resourceType: "vote",
          resourceId: `${matchId}|project1|${votesReceived}`,
          title: notificationConfig.title,
          previewTitle: notificationConfig.previewTitle || null,
          message: notificationConfig.message,
          read: "false",
          createdAt: now,
          actions: JSON.stringify(notificationConfig.actions),
          sound: notificationConfig.sound || null,
          icon: projectSide === "project1" ? "mdi:thumb-up" : "mdi:thumb-down",
          displayComponent: notificationConfig.displayComponent || null,
          priority: notificationConfig.priority ? "true" : "false",
        })
        .execute();
    }

    // Notify project2 owner
    if (project2 && project2.userId !== userId) {
      const notificationId = nanoid();
      // Store matchId, projectSide, and votingWeight received in resourceId as "matchId|projectSide|votingWeight"
      // votingWeight is the weight added in THIS event (positive if voted for, negative if voted against)
      const votesReceived = projectSide === "project2" ? votingWeight : -votingWeight;
      
      // Determine if project2 got the vote or opponent got it
      const project2GotVote = projectSide === "project2";
      const notificationSubtype = project2GotVote ? "received" : "opponentReceived";
      const message = project2GotVote 
        ? getRandomMessage(receivedVoteMessages)
        : getRandomMessage(opponentReceivedVoteMessages);
      
      const notificationConfig = getNotificationConfig("vote", notificationSubtype, {
        message,
        cupId: match.cupId,
        matchId: matchId,
      });
      
      await zeroDb
        .insertInto("notification")
        .values({
          id: notificationId,
          userId: project2.userId,
          resourceType: "vote",
          resourceId: `${matchId}|project2|${votesReceived}`,
          title: notificationConfig.title,
          previewTitle: notificationConfig.previewTitle || null,
          message: notificationConfig.message,
          read: "false",
          createdAt: now,
          actions: JSON.stringify(notificationConfig.actions),
          sound: notificationConfig.sound || null,
          icon: projectSide === "project2" ? "mdi:thumb-up" : "mdi:thumb-down",
          displayComponent: notificationConfig.displayComponent || null,
          priority: notificationConfig.priority ? "true" : "false",
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

