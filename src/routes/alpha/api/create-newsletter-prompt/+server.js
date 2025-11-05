import { json } from "@sveltejs/kit";
import { requireAuth } from "$lib/api-helpers.server.js";
import { zeroDb } from "$lib/db.server.js";
import { nanoid } from "nanoid";
import { getNotificationConfig } from "$lib/notification-helpers.server.js";

/**
 * POST /alpha/api/create-newsletter-prompt
 * Creates newsletter prompt notification for a new user (on first signup)
 * Should be called immediately after signup, before onboarding
 */
export async function POST({ request }) {
  try {
    // Authenticate user
    const user = await requireAuth(request);

    // Check if user already has preferences or has received newsletter prompt
    const existingPrefs = await zeroDb
      .selectFrom("userPreferences")
      .select(["id"])
      .where("userId", "=", user.id)
      .executeTakeFirst();

    const existingNewsletterPrompt = await zeroDb
      .selectFrom("notification")
      .select(["id"])
      .where("userId", "=", user.id)
      .where("resourceType", "=", "signup")
      .where("resourceId", "=", "newsletterPrompt")
      .executeTakeFirst();

    // Only create if user hasn't received it and doesn't have preferences set
    if (existingPrefs || existingNewsletterPrompt) {
      return json({
        success: true,
        message: "Newsletter prompt already exists or user has preferences",
        alreadyExists: true,
      });
    }

    // Get notification config for newsletter prompt
    const newsletterConfig = getNotificationConfig("signup", "newsletterPrompt", {});

    if (!newsletterConfig) {
      return json({ error: "Newsletter notification configuration not found" }, { status: 500 });
    }

    const now = new Date().toISOString();
    const newsletterNotificationId = nanoid();
    
    await zeroDb
      .insertInto("notification")
      .values({
        id: newsletterNotificationId,
        userId: user.id,
        resourceType: "signup",
        resourceId: "newsletterPrompt",
        title: newsletterConfig.title,
        previewTitle: newsletterConfig.previewTitle || "",
        message: newsletterConfig.message,
        read: "false",
        createdAt: now,
        actions: JSON.stringify(newsletterConfig.actions || []),
        sound: newsletterConfig.sound || "/mail.mp3",
        icon: newsletterConfig.icon || "mdi:email-newsletter",
        displayComponent: newsletterConfig.displayComponent || "",
        priority: String(newsletterConfig.priority || true),
        imageUrl: "",
      })
      .execute();

    return json({
      success: true,
      message: "Newsletter prompt notification created",
      notificationId: newsletterNotificationId,
    });
  } catch (error) {
    console.error("Failed to create newsletter prompt:", error);
    return json(
      {
        error: error instanceof Error ? error.message : "Failed to create newsletter prompt",
      },
      { status: 500 }
    );
  }
}

