import { json } from "@sveltejs/kit";
import { nanoid } from "nanoid";
import { requireAdmin } from "$lib/api-helpers.server.js";
import { zeroDb } from "$lib/db.server.js";
import { authDb } from "$lib/db.server.js";

export async function POST({ request }) {
  // Get the user who is onboarding (currently requires admin, but can be extended later)
  const onboarderUser = await requireAdmin(request);

  try {
    const { userId } = await request.json();

    if (!userId) {
      return json({ error: "User ID is required" }, { status: 400 });
    }

    // Check if user already has explorer identity
    const existingExplorer = await zeroDb
      .selectFrom("userIdentities")
      .select(["id"])
      .where("userId", "=", userId)
      .where("identityType", "=", "explorer")
      .executeTakeFirst();

    if (existingExplorer) {
      return json({ 
        error: "User already has explorer identity",
        alreadyOnboarded: true 
      }, { status: 400 });
    }

    // Get the onboarder's profile info (name and image) - dynamically gets whoever onboarded them
    const onboarderProfile = await authDb
      .selectFrom("user")
      .select(["id", "name", "image"])
      .where("id", "=", onboarderUser.id)
      .executeTakeFirst();

    const onboarderName = onboarderProfile?.name || "someone";
    const onboarderImage = onboarderProfile?.image || null;

    // Create explorer identity
    const identityId = nanoid();
    const now = new Date().toISOString();

    await zeroDb
      .insertInto("userIdentities")
      .values({
        id: identityId,
        userId,
        identityType: "explorer",
        votingWeight: 0, // No voting rights
        selectedAt: now,
        upgradedFrom: null,
      })
      .execute();

    // Create priority notification for the user
    // Store onboarder image URL in resourceId format: "identityId|onboarderImageUrl"
    // This allows us to display the inviter's profile image in the notification
    const resourceId = onboarderImage 
      ? `${identityId}|${onboarderImage}`
      : identityId;
    
    const notificationId = nanoid();
    await zeroDb
      .insertInto("notification")
      .values({
        id: notificationId,
        userId: userId,
        resourceType: "identityPurchase",
        resourceId: resourceId,
        title: "Welcome to Hominio! 🎉",
        previewTitle: "",
        message: `You've been invited by ${onboarderName}! Welcome to the Hominio community. Start exploring and when you're ready, upgrade to vote on projects.`,
        read: "false",
        createdAt: now,
        actions: JSON.stringify([
          {
            label: "Start Exploring",
            action: "navigate",
            url: "/alpha",
          },
        ]),
        sound: "/notification.mp3",
        icon: "mdi:account-plus",
        displayComponent: "",
        priority: "true", // Priority notification - force opens
      })
      .execute();

    return json({
      success: true,
      message: "User successfully onboarded as explorer",
      identity: {
        id: identityId,
        userId,
        identityType: "explorer",
        votingWeight: 0,
      },
    });
  } catch (error) {
    console.error("Error onboarding user:", error);
    return json(
      { error: error instanceof Error ? error.message : "Failed to onboard user" },
      { status: 500 }
    );
  }
}

