import { json } from "@sveltejs/kit";
import { nanoid } from "nanoid";
import { requireAdmin } from "$lib/api-helpers.server.js";
import { zeroDb } from "$lib/db.server.js";
import { authDb } from "$lib/db.server.js";
import { getNotificationConfig } from "$lib/notification-helpers.server.js";

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
    
    // Create timestamp slightly in the future for welcome message (so newsletter comes first)
    const welcomeTimestamp = new Date(Date.now() + 1000).toISOString();

    await zeroDb
      .insertInto("userIdentities")
      .values({
        id: identityId,
        userId,
        identityType: "explorer",
        selectedAt: now,
        upgradedFrom: null,
      })
      .execute();

    // Newsletter prompt should already have been created on signup (before onboarding)
    // So we don't create it here - just create the welcome message

    // Create priority notification for the user (welcome message)
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
        message: `You've been invited by ${onboarderName}! Welcome to the Hominio community.`,
        read: "false",
        createdAt: welcomeTimestamp, // Later timestamp - appears after newsletter
        actions: JSON.stringify([
          {
            label: "Start Exploring",
            action: "navigate",
            url: "/alpha",
          },
        ]),
        sound: "/welcome.mp3",
        icon: "mdi:account-plus",
        displayComponent: "",
        priority: "true", // Priority notification - force opens
        imageUrl: "",
      })
      .execute();

    return json({
      success: true,
      message: "User successfully onboarded as explorer",
      identity: {
        id: identityId,
        userId,
        identityType: "explorer",
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

