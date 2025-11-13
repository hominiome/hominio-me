import { json } from "@sveltejs/kit";
import { requireAuth } from "$lib/api-helpers.server.js";
import { getZeroDbInstance } from "$lib/db.server.js";
import { nanoid } from "nanoid";

/**
 * POST /alpha/api/create-push-prompt
 * Creates push notification prompt for a new user (on first signup)
 * Should be called immediately after signup, before onboarding
 */
export async function POST({ request }) {
  try {
    // Authenticate user
    const user = await requireAuth(request);

    const zeroDb = getZeroDbInstance();

    // Get user agent from request to identify device
    const userAgent = request.headers.get('user-agent') || '';
    
    // Check if user has any push subscriptions
    const existingSubscriptions = await zeroDb
      .selectFrom("pushSubscription")
      .select(["id", "endpoint"])
      .where("userId", "=", user.id)
      .execute();

    // Check if current device already has a subscription
    // We can't check the exact endpoint without the subscription object,
    // but we can check if user has any subscriptions at all
    // If user has subscriptions, they've already enabled push on at least one device
    
    // Check if user has already received a push prompt notification
    const existingPushPrompt = await zeroDb
      .selectFrom("notification")
      .select(["id"])
      .where("userId", "=", user.id)
      .where("resourceType", "=", "signup")
      .where("resourceId", "=", "pushPrompt")
      .where("read", "=", "false") // Only check unread prompts
      .executeTakeFirst();

    // Only create if:
    // 1. User has no push subscriptions (hasn't enabled push on any device)
    // 2. User hasn't received an unread push prompt yet
    if (existingSubscriptions.length > 0 || existingPushPrompt) {
      return json({
        success: true,
        message: "Push prompt already exists or user has push enabled",
        alreadyExists: true,
      });
    }

    const now = new Date().toISOString();
    const pushNotificationId = nanoid();
    
    await zeroDb
      .insertInto("notification")
      .values({
        id: pushNotificationId,
        userId: user.id,
        resourceType: "signup",
        resourceId: "pushPrompt",
        title: "Enable Push Notifications",
        previewTitle: "Stay connected",
        message: "Enable push notifications to receive priority updates even when your browser is closed.",
        read: "false",
        createdAt: now,
        actions: JSON.stringify([
          {
            label: "No, thanks",
            action: "mark_read",
            position: "left",
          },
          {
            label: "Enable Push",
            action: "enable_push",
            url: "/alpha/me",
            position: "right",
          },
        ]),
        sound: "/notification.mp3",
        icon: "mdi:bell-ring",
        displayComponent: "",
        priority: "true",
        imageUrl: "",
      })
      .execute();

    return json({
      success: true,
      message: "Push prompt notification created",
      notificationId: pushNotificationId,
    });
  } catch (error) {
    console.error("Failed to create push prompt:", error);
    return json(
      {
        error: error instanceof Error ? error.message : "Failed to create push prompt",
      },
      { status: 500 }
    );
  }
}

