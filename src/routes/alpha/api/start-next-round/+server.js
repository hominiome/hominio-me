import { json } from "@sveltejs/kit";
import { nanoid } from "nanoid";
import { requireAdmin } from "$lib/api-helpers.server.js";
import { zeroDb } from "$lib/db.server.js";
import { getNotificationConfig } from "$lib/notification-helpers.server.js";

export async function POST({ request }) {
  // Require admin access (throws 401/403 if not authenticated/admin)
  await requireAdmin(request);

  const { cupId, endDate } = await request.json();

  if (!cupId) {
    return json({ error: "Cup ID is required" }, { status: 400 });
  }

  if (!endDate) {
    return json({ error: "End date is required" }, { status: 400 });
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
    
    const { checkAndCloseExpired } = await import("$lib/expiry-checker.server.js");
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

    // Use updated cup's current round (in case it changed)
    const finalCurrentRound = updatedCup.currentRound || currentRound;

    // Calculate next round name based on current round
    // Round progression:
    // round_128 → round_64 → round_32 → round_16 → quarter → semi → final
    // round_64 → round_32 → round_16 → quarter → semi → final
    // round_32 → round_16 → quarter → semi → final
    // round_16 → quarter → semi → final
    // round_8 → semi → final
    // round_4 → final
    let nextRound = null;
    if (finalCurrentRound === "round_128") {
      nextRound = "round_64";
    } else if (finalCurrentRound === "round_64") {
      nextRound = "round_32";
    } else if (finalCurrentRound === "round_32") {
      nextRound = "round_16";
    } else if (finalCurrentRound === "round_16") {
      nextRound = "quarter";
    } else if (finalCurrentRound === "round_8") {
      nextRound = "semi";
    } else if (finalCurrentRound === "round_4") {
      nextRound = "final";
    } else if (finalCurrentRound === "quarter") {
      nextRound = "semi";
    } else if (finalCurrentRound === "semi") {
      nextRound = "final";
    } else if (finalCurrentRound === "final") {
      return json({ error: "Final round has no next round" }, { status: 400 });
    }

    if (!nextRound) {
      return json({ error: "Cannot determine next round" }, { status: 400 });
    }

    // Check if next round already exists
    const existingNextRoundMatches = await zeroDb
      .selectFrom("cupMatch")
      .selectAll()
      .where("cupId", "=", cupId)
      .where("round", "=", nextRound)
      .execute();

    if (existingNextRoundMatches.length > 0) {
      return json(
        {
          error: "Next round already exists! Cannot start again.",
        },
        { status: 400 }
      );
    }

    // Re-fetch matches in current round to collect winners (in case any were closed)
    const finalCurrentMatches = await zeroDb
      .selectFrom("cupMatch")
      .selectAll()
      .where("cupId", "=", cupId)
      .where("round", "=", finalCurrentRound)
      .execute();

    // Collect winners from current round matches
    const winners = [];

    for (const match of finalCurrentMatches) {
      if (!match.winnerId) {
        return json(
          {
            error: `Match ${match.id} doesn't have a winner. Please determine winners before starting next round.`,
          },
          { status: 400 }
        );
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
          error: `Cannot start next round: Expected even number of winners, got ${winners.length}. Some matches may be missing winners.`,
        },
        { status: 400 }
      );
    }

    // Create next round matches (matchmaking)
    // Pair winners: position 0+1, 2+3, 4+5, 6+7 for quarters
    // Pair winners: position 0+1, 2+3 for semis
    // Pair winners: position 0+1 for final

    const sortedWinners = winners.sort((a, b) => a.position - b.position);

    for (let i = 0; i < sortedWinners.length; i += 2) {
      const winner1 = sortedWinners[i];
      const winner2 = sortedWinners[i + 1];

      if (winner1 && winner2) {
        const matchId = nanoid();

        // Create next round match with endDate
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
            endDate: endDate, // Set round-level end date
          })
          .execute();

        // Create opponent reveal notifications for both participants
        // Get project owners
        const project1 = await zeroDb
          .selectFrom("project")
          .select(["userId"])
          .where("id", "=", winner1.winnerId)
          .executeTakeFirst();

        const project2 = await zeroDb
          .selectFrom("project")
          .select(["userId"])
          .where("id", "=", winner2.winnerId)
          .executeTakeFirst();

        // Notify project1 owner about project2 (their opponent)
        if (project1?.userId) {
          const notificationConfig = getNotificationConfig("opponentReveal", "revealed", {
            matchId: matchId,
          });

          const notificationId = nanoid();
          await zeroDb
            .insertInto("notification")
            .values({
              id: notificationId,
              userId: project1.userId,
              resourceType: "opponentReveal",
              resourceId: `${matchId}|${winner2.winnerId}`, // matchId|opponentProjectId
              title: notificationConfig.title,
              previewTitle: notificationConfig.previewTitle || null,
              message: notificationConfig.message,
              read: "false",
              createdAt: now,
              actions: JSON.stringify(notificationConfig.actions),
              sound: notificationConfig.sound || null,
              icon: notificationConfig.icon || null,
              displayComponent: notificationConfig.displayComponent || null,
              priority: notificationConfig.priority ? "true" : "false",
            })
            .execute();
        }

        // Notify project2 owner about project1 (their opponent)
        if (project2?.userId) {
          const notificationConfig = getNotificationConfig("opponentReveal", "revealed", {
            matchId: matchId,
          });

          const notificationId = nanoid();
          await zeroDb
            .insertInto("notification")
            .values({
              id: notificationId,
              userId: project2.userId,
              resourceType: "opponentReveal",
              resourceId: `${matchId}|${winner1.winnerId}`, // matchId|opponentProjectId
              title: notificationConfig.title,
              previewTitle: notificationConfig.previewTitle || null,
              message: notificationConfig.message,
              read: "false",
              createdAt: now,
              actions: JSON.stringify(notificationConfig.actions),
              sound: notificationConfig.sound || null,
              icon: notificationConfig.icon || null,
              displayComponent: notificationConfig.displayComponent || null,
              priority: notificationConfig.priority ? "true" : "false",
            })
            .execute();
        }
      }
    }

    // Update cup to next round (use updatedCup to ensure we have latest status)
    await zeroDb
      .updateTable("cup")
      .set({
        currentRound: nextRound,
        updatedAt: now,
      })
      .where("id", "=", cupId)
      .execute();

    return json({
      success: true,
      nextRound,
      matchesCreated: Math.floor(winners.length / 2),
      message: `Next round started! ${Math.floor(winners.length / 2)} matches created for ${nextRound}.`,
    });
  } catch (error) {
    console.error("Start next round error:", error);
    // If error is already a JSON response (from requireAdmin), re-throw it
    if (error && typeof error === "object" && "status" in error) {
      throw error;
    }
    return json(
      {
        error:
          error instanceof Error ? error.message : "Failed to start next round",
        details: error instanceof Error ? error.toString() : String(error),
      },
      { status: 500 }
    );
  }
}
