import { json } from "@sveltejs/kit";
import { requireAdmin } from "$lib/api-helpers.server.js";
import { getZeroDbInstance } from "$lib/db.server.js";
import { nanoid } from "nanoid";
import { getNotificationConfig } from "$lib/notification-helpers.server.js";

/**
 * POST /alpha/api/send-newsletter
 * Admin-only endpoint to send newsletter notifications to all subscribed users
 */
export async function POST({ request }) {
  try {
    // Verify admin access
    await requireAdmin(request);

    const body = await request.json();
    const { title, previewTitle, message, imageUrl, actions } = body;

    // Validate required fields
    if (!title || !title.trim()) {
      return json({ error: "Title is required" }, { status: 400 });
    }
    if (!message || !message.trim()) {
      return json({ error: "Message is required" }, { status: 400 });
    }

    const zeroDb = getZeroDbInstance();

    // Get all users with newsletter subscription enabled
    const subscribedUsers = await zeroDb
      .selectFrom("userPreferences")
      .selectAll()
      .where("newsletterSubscribed", "=", "true")
      .execute();

    if (subscribedUsers.length === 0) {
      return json({
        success: true,
        count: 0,
        message: "No subscribed users found",
      });
    }

    // Get notification config for newsletter type
    const notificationConfig = getNotificationConfig(
      "newsletter",
      "announcement",
      {
        title: title.trim(),
        previewTitle: previewTitle?.trim() || "",
        message: message.trim(),
      }
    );

    if (!notificationConfig) {
      return json(
        { error: "Failed to load notification configuration" },
        { status: 500 }
      );
    }

    // Generate a unique newsletter ID for this send
    const newsletterId = nanoid();

    // Prepare notification data
    const notificationData = {
      resourceType: "newsletter",
      resourceId: newsletterId,
      title: notificationConfig.title,
      previewTitle: notificationConfig.previewTitle || "",
      message: notificationConfig.message,
      read: "false",
      createdAt: new Date().toISOString(),
      actions: actions ? JSON.stringify(actions) : notificationConfig.actions ? JSON.stringify(notificationConfig.actions) : "[]",
      sound: notificationConfig.sound || "/notification.mp3",
      icon: notificationConfig.icon || "mdi:email-newsletter",
      displayComponent: imageUrl && imageUrl.trim() ? (notificationConfig.displayComponent || "") : "",
      priority: notificationConfig.priority ? "true" : "false",
      imageUrl: imageUrl && imageUrl.trim() ? imageUrl.trim() : "",
    };

    // Create notifications for each subscribed user
    const notificationPromises = subscribedUsers.map(async (pref) => {
      const notificationId = nanoid();
      return zeroDb
        .insertInto("notification")
        .values({
          id: notificationId,
          userId: pref.userId,
          ...notificationData,
        })
        .execute();
    });

    await Promise.all(notificationPromises);

    return json({
      success: true,
      count: subscribedUsers.length,
      message: `Newsletter sent to ${subscribedUsers.length} user${subscribedUsers.length === 1 ? "" : "s"}`,
    });
  } catch (error) {
    console.error("Send newsletter error:", error);
    return json(
      {
        error: error instanceof Error ? error.message : "Failed to send newsletter",
      },
      { status: 500 }
    );
  }
}

