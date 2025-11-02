import { json } from "@sveltejs/kit";
import { nanoid } from "nanoid";
import { requireAdmin } from "$lib/api-helpers.server.js";
import { zeroDb } from "$lib/db.server.js";
import { checkAndCloseExpired } from "$lib/expiry-checker.server.js";
import { getNotificationConfig } from "$lib/notification-helpers.server.js";

function getRoundLabel(round) {
  switch (round) {
    case "round_4":
      return "Round of 4";
    case "round_8":
      return "Round of 8";
    case "round_16":
      return "Round of 16";
    case "round_32":
      return "Round of 32";
    case "round_64":
      return "Round of 64";
    case "round_128":
      return "Round of 128";
    case "quarter":
      return "Quarter Finals";
    case "semi":
      return "Semi Finals";
    case "final":
      return "Final";
    default:
      return round;
  }
}

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

    // Check if cup or matches have expired before processing
    const currentRound = cup.currentRound;
    const currentMatches = await zeroDb
      .selectFrom("cupMatch")
      .selectAll()
      .where("cupId", "=", cupId)
      .where("round", "=", currentRound)
      .execute();

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

    // Re-fetch matches in case any were closed
    const updatedMatches = await zeroDb
      .selectFrom("cupMatch")
      .selectAll()
      .where("cupId", "=", cupId)
      .where("round", "=", currentRound)
      .execute();

    if (updatedMatches.length === 0) {
      return json(
        { error: "No matches found in current round" },
        { status: 400 }
      );
    }

    // Automatically determine winners for matches that don't have winners yet
    const matchesWithoutWinners = updatedMatches.filter((m) => !m.winnerId);

    for (const match of matchesWithoutWinners) {
      // Get vote counts from vote table
      const votes1Result = await zeroDb
        .selectFrom("vote")
        .select(({ fn }) => [fn.sum("votingWeight").as("total")])
        .where("matchId", "=", match.id)
        .where("projectSide", "=", "project1")
        .executeTakeFirst();

      const votes2Result = await zeroDb
        .selectFrom("vote")
        .select(({ fn }) => [fn.sum("votingWeight").as("total")])
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

    // Re-fetch all matches in current round to get updated winners (after determining winners)
    const finalMatches = await zeroDb
      .selectFrom("cupMatch")
      .selectAll()
      .where("cupId", "=", cupId)
      .where("round", "=", currentRound)
      .execute();

    // Count winners
    const winnersCount = finalMatches.filter((m) => m.winnerId).length;

    // Check if this is the final round BEFORE creating notifications
    const isFinalRound = currentRound === "final";

    // Create round win notifications for all winners (only if NOT final round)
    // Also create match loss notifications for losers
    const roundLabel = getRoundLabel(currentRound);
    for (const match of finalMatches) {
      if (match.winnerId) {
        // Get both projects to notify winner and loser
        const project1 = await zeroDb
          .selectFrom("project")
          .select(["userId", "id", "name"])
          .where("id", "=", match.project1Id)
          .executeTakeFirst();

        const project2 = await zeroDb
          .selectFrom("project")
          .select(["userId", "id", "name"])
          .where("id", "=", match.project2Id)
          .executeTakeFirst();

        // Notify winner (only if NOT final round - final round gets champion notification instead)
        const winningProject = match.winnerId === match.project1Id ? project1 : project2;
        if (winningProject?.userId && !isFinalRound) {
          const notificationConfig = getNotificationConfig("roundWin", "won", {
            roundName: roundLabel,
            cupName: updatedCup.name,
          });

          const notificationId = nanoid();
          await zeroDb
            .insertInto("notification")
            .values({
              id: notificationId,
              userId: winningProject.userId,
              resourceType: "roundWin",
              resourceId: `${match.id}|${match.winnerId}`,
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

        // Notify loser
        const losingProject = match.winnerId === match.project1Id ? project2 : project1;
        const winningProjectName = winningProject?.name || "an opponent";
        if (losingProject?.userId) {
          // Create message with winning project name
          const lossMessage = `This Time ${winningProjectName} made it. But success isn't just about winning - it's about the lessons learned. You've gained invaluable insights. Stand up quick and continue your founder journey! Your day will come soon!`;
          
          const notificationConfig = getNotificationConfig("matchLoss", "eliminated", {
            message: lossMessage,
            winningProjectName: winningProjectName,
          });

          const notificationId = nanoid();
          await zeroDb
            .insertInto("notification")
            .values({
              id: notificationId,
              userId: losingProject.userId,
              resourceType: "matchLoss",
              resourceId: `${match.id}|${losingProject.id}`,
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

    if (isFinalRound) {
      // Final round completed, mark cup as completed
      const finalWinner = finalMatches.find((m) => m.winnerId);
      await zeroDb
        .updateTable("cup")
        .set({
          status: "completed",
          winnerId: finalWinner?.winnerId || "",
          completedAt: now,
          updatedAt: now,
        })
        .where("id", "=", cupId)
        .execute();

      // Create cup win celebration notification for the champion
      if (finalWinner?.winnerId) {
        const championProject = await zeroDb
          .selectFrom("project")
          .select(["userId"])
          .where("id", "=", finalWinner.winnerId)
          .executeTakeFirst();

        if (championProject?.userId) {
          // Re-fetch cup to ensure we have the latest name
          const finalCup = await zeroDb
            .selectFrom("cup")
            .selectAll()
            .where("id", "=", cupId)
            .executeTakeFirst();

          const notificationConfig = getNotificationConfig("cupWin", "champion", {
            cupName: finalCup?.name || updatedCup.name,
            cupId: cupId,
          });

          const notificationId = nanoid();
          await zeroDb
            .insertInto("notification")
            .values({
              id: notificationId,
              userId: championProject.userId,
              resourceType: "cupWin",
              resourceId: `${cupId}|${finalWinner.winnerId}`,
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

    return json({
      success: true,
      winnersCount,
      message: isFinalRound
        ? `Cup completed! Winner determined.`
        : `Round completed! ${winnersCount} winners determined. Use "Start Next Round" to advance.`,
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
