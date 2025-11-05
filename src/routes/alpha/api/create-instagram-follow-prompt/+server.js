import { json } from "@sveltejs/kit";
import { requireAuth } from "$lib/api-helpers.server.js";
import { zeroDb } from "$lib/db.server.js";
import { nanoid } from "nanoid";
import { getNotificationConfig } from "$lib/notification-helpers.server.js";

/**
 * POST /alpha/api/create-instagram-follow-prompt
 * Creates Instagram follow prompt notification for a new user (on first signup)
 * Should be called immediately after signup, after newsletter prompt
 */
export async function POST({ request }) {
  try {
    // Authenticate user
    const user = await requireAuth(request);

    // Check if user already has received Instagram follow prompt
    const existingInstagramPrompt = await zeroDb
      .selectFrom("notification")
      .select(["id"])
      .where("userId", "=", user.id)
      .where("resourceType", "=", "signup")
      .where("resourceId", "=", "instagramFollow")
      .executeTakeFirst();

    // Only create if user hasn't received it
    if (existingInstagramPrompt) {
      return json({
        success: true,
        message: "Instagram follow prompt already exists",
        alreadyExists: true,
      });
    }

    // Get notification config for Instagram follow prompt
    const instagramConfig = getNotificationConfig("signup", "instagramFollow", {});

    if (!instagramConfig) {
      return json({ error: "Instagram follow notification configuration not found" }, { status: 500 });
    }

    const now = new Date().toISOString();
    const instagramNotificationId = nanoid();
    
    await zeroDb
      .insertInto("notification")
      .values({
        id: instagramNotificationId,
        userId: user.id,
        resourceType: "signup",
        resourceId: "instagramFollow",
        title: instagramConfig.title,
        previewTitle: instagramConfig.previewTitle || "",
        message: instagramConfig.message,
        read: "false",
        createdAt: now,
        actions: JSON.stringify(instagramConfig.actions || []),
        sound: instagramConfig.sound || "/mail.mp3",
        icon: instagramConfig.icon || "mdi:instagram",
        displayComponent: instagramConfig.displayComponent || "",
        priority: String(instagramConfig.priority || true),
        imageUrl: "",
      })
      .execute();

    return json({
      success: true,
      message: "Instagram follow prompt notification created",
      notificationId: instagramNotificationId,
    });
  } catch (error) {
    console.error("Failed to create Instagram follow prompt:", error);
    return json(
      {
        error: error instanceof Error ? error.message : "Failed to create Instagram follow prompt",
      },
      { status: 500 }
    );
  }
}

