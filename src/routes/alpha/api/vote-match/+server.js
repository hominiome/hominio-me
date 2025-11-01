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

  const { matchId, projectSide, amount } = await request.json();

  if (!matchId || !projectSide || !amount || amount <= 0) {
    return json({ error: "Invalid parameters" }, { status: 400 });
  }

  if (projectSide !== "project1" && projectSide !== "project2") {
    return json({ error: "Invalid project side" }, { status: 400 });
  }

  const userId = session.user.id;
  const now = new Date().toISOString();

  try {
    // Get user wallet
    const userWallet = await zeroDb
      .selectFrom("wallet")
      .selectAll()
      .where("entityType", "=", "user")
      .where("entityId", "=", userId)
      .executeTakeFirst();

    if (!userWallet) {
      return json({ error: "User wallet not found" }, { status: 404 });
    }

    // Check user has enough hearts
    if (userWallet.balance < amount) {
      return json(
        {
          error: `Insufficient hearts. You have ${userWallet.balance}, need ${amount}`,
        },
        { status: 400 }
      );
    }

    // Get match
    const match = await zeroDb
      .selectFrom("cupMatch")
      .selectAll()
      .where("id", "=", matchId)
      .executeTakeFirst();

    if (!match) {
      return json({ error: "Match not found" }, { status: 404 });
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

    // Get target wallet
    const targetWalletId =
      projectSide === "project1"
        ? match.project1WalletId
        : match.project2WalletId;

    if (!targetWalletId) {
      return json({ error: "Project wallet not found" }, { status: 404 });
    }

    const targetWallet = await zeroDb
      .selectFrom("wallet")
      .selectAll()
      .where("id", "=", targetWalletId)
      .executeTakeFirst();

    if (!targetWallet) {
      return json({ error: "Target wallet not found" }, { status: 404 });
    }

    // Create transaction with user profile info
    await zeroDb
      .insertInto("transaction")
      .values({
        id: nanoid(),
        fromWalletId: userWallet.id,
        toWalletId: targetWalletId,
        amount,
        type: "vote",
        metadata: JSON.stringify({
          matchId,
          projectSide,
          userId: session.user.id,
          userName: session.user.name || "Anonymous",
          userImage: session.user.image || null,
          timestamp: Date.now(),
        }),
        createdAt: now,
      })
      .execute();

    // Update user wallet (deduct hearts)
    await zeroDb
      .updateTable("wallet")
      .set({
        balance: userWallet.balance - amount,
        updatedAt: now,
      })
      .where("id", "=", userWallet.id)
      .execute();

    // Update target wallet (add hearts)
    await zeroDb
      .updateTable("wallet")
      .set({
        balance: targetWallet.balance + amount,
        updatedAt: now,
      })
      .where("id", "=", targetWalletId)
      .execute();

    return json({
      success: true,
      newUserBalance: userWallet.balance - amount,
      newTargetBalance: targetWallet.balance + amount,
      voted: amount,
    });
  } catch (error) {
    console.error("Vote match error:", error);
    return json({ error: "Vote failed" }, { status: 500 });
  }
}

