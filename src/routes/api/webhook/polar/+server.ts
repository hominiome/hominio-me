import { Webhooks } from "@polar-sh/sveltekit";
import { env } from "$env/dynamic/private";
import { json } from "@sveltejs/kit";
import { getZeroDbInstance } from "$lib/db.server.js";
import { nanoid } from "nanoid";

/**
 * Polar Webhook Endpoint
 * Native SvelteKit adapter for Polar webhooks
 * Handles signature verification and routes to event handlers
 * 
 * Endpoint: /api/webhook/polar
 * Configure this URL in Polar Dashboard: https://hominio-me.loca.lt/api/webhook/polar
 * 
 * Database Storage:
 * - All webhook events are stored in `polar_webhook_events` table (Zero Postgres DB)
 * - Events stored with full JSONB payload for audit trail and debugging
 * - Deduplication via `polar_event_id` (format: `{event_type}:{data.id}` or `{event_type}:{timestamp}`)
 * - Events marked as `processed: false` initially
 * 
 * Processing Strategy:
 * - Option 1 (Current): Events stored, handlers log only - `processed` stays false
 * - Option 2 (Future): Add normalization logic in handlers to create/update normalized tables
 *   (e.g., subscriptions, orders tables) and mark as `processed: true` after normalization
 * - Option 3 (Future): Background worker picks up `processed=false` events and normalizes them
 * 
 * Indexes created for: event_type, processed status, created_at, and JSONB customer_id queries
 * 
 * See: https://polar.sh/docs/api-reference/webhooks for event schemas
 */

// Helper function to store webhook event in database
async function storeWebhookEvent(payload: any) {
  try {
    const db = getZeroDbInstance();

    // Extract unique identifier from payload for deduplication
    // Polar webhooks include timestamp + type, and data objects have IDs
    // Use data.id if available (e.g., checkout.id, order.id, subscription.id)
    // Otherwise, use a combination of type + timestamp for deduplication
    const dataId = payload.data?.id || null;
    const timestamp = payload.timestamp || new Date().toISOString();

    // Create a unique identifier: if data has an ID, use type + data.id
    // Otherwise use type + timestamp (less reliable but better than nothing)
    const polarEventId = dataId
      ? `${payload.type}:${dataId}`
      : `${payload.type}:${timestamp}`;

    // Check if event already exists (deduplication)
    const existing = await db
      .selectFrom("polar_webhook_events")
      .selectAll()
      .where("polar_event_id", "=", polarEventId)
      .executeTakeFirst();

    if (existing) {
      return existing.id;
    }

    // Generate our own ID
    const eventId = nanoid();

    // Store event in database
    await db
      .insertInto("polar_webhook_events")
      .values({
        id: eventId,
        event_type: payload.type,
        polar_event_id: polarEventId,
        payload: payload, // JSONB column automatically handles JSON
        processed: false,
        created_at: new Date(),
      })
      .execute();

    return eventId;
  } catch (error: any) {
    // Don't fail webhook processing if storage fails
    return null;
  }
}

// Helper function to mark event as processed by event ID
async function markEventProcessed(eventId: string | null, error?: Error) {
  if (!eventId) return;

  try {
    const db = getZeroDbInstance();

    await db
      .updateTable("polar_webhook_events")
      .set({
        processed: true,
        processed_at: new Date(),
        error_message: error ? error.message : null,
      })
      .where("id", "=", eventId)
      .execute();
  } catch (err) {
    // Silently fail - event processing should continue
  }
}

// Helper function to mark event as processed by payload (finds event by polar_event_id)
async function markEventProcessedByPayload(payload: any, error?: Error) {
  try {
    const db = getZeroDbInstance();

    // Reconstruct the same polar_event_id we used when storing
    const dataId = payload.data?.id || null;
    const timestamp = payload.timestamp || new Date().toISOString();
    const polarEventId = dataId
      ? `${payload.type}:${dataId}`
      : `${payload.type}:${timestamp}`;

    await db
      .updateTable("polar_webhook_events")
      .set({
        processed: true,
        processed_at: new Date(),
        error_message: error ? error.message : null,
      })
      .where("polar_event_id", "=", polarEventId)
      .execute();
  } catch (err) {
    // Silently fail - event processing should continue
  }
}

// Shared helper to extract user info from payload
function extractUserInfo(payload: any) {
  const customerExternalId = payload.data?.customer?.externalId;

  if (!customerExternalId || customerExternalId.trim() === "") {
    return null;
  }

  const userId = customerExternalId.trim();

  if (!userId || userId.length === 0) {
    return null;
  }

  return {
    userId,
    subscriptionId: payload.data?.id,
    currentPeriodEnd: payload.data?.currentPeriodEnd,
  };
}

// Shared helper to get identities
async function getIdentities(userId: string) {
  const zeroDb = getZeroDbInstance();
  const existingIdentities = await zeroDb
    .selectFrom("userIdentities")
    .selectAll()
    .where("userId", "=", userId)
    .execute();

  return {
    explorerIdentity: existingIdentities.find(id => id.identityType === "explorer"),
    hominioIdentity: existingIdentities.find(id => id.identityType === "hominio"),
  };
}

// Shared helper to ensure explorer identity exists
async function ensureExplorerIdentity(userId: string, upgradedFrom: string | null = null) {
  const { explorerIdentity } = await getIdentities(userId);

  if (!explorerIdentity) {
    const zeroDb = getZeroDbInstance();
    const explorerId = nanoid();
    await zeroDb
      .insertInto("userIdentities")
      .values({
        id: explorerId,
        userId,
        identityType: "explorer",
        votingWeight: 0,
        selectedAt: new Date().toISOString(),
        upgradedFrom: upgradedFrom,
      })
      .execute();
  }
}

// Shared helper to create notification
async function createNotification(
  userId: string,
  subscriptionId: string,
  title: string,
  message: string,
  actionLabel: string = "Renew Subscription",
  actionUrl: string = "/alpha/purchase",
  actionType: string = "navigate" // "navigate" or "renew_subscription"
) {
  if (!userId || userId.trim() === "") {
    return;
  }

  const zeroDb = getZeroDbInstance();
  const notificationId = nanoid();

  await zeroDb
    .insertInto("notification")
    .values({
      id: notificationId,
      userId: userId.trim(),
      resourceType: "subscription",
      resourceId: subscriptionId || "",
      title,
      previewTitle: "",
      message,
      read: "false",
      createdAt: new Date().toISOString(),
      actions: JSON.stringify([
        {
          label: actionLabel,
          action: actionType,
          url: actionUrl, // Keep URL as fallback for error cases
        },
      ]),
      sound: "/notification.mp3",
      icon: "mdi:check-circle",
      displayComponent: "",
      priority: "true",
    })
    .execute();
}

// Create webhook handlers configuration
const webhookConfig = {

  // Catch-all handler for any webhook event
  onPayload: async (payload: any) => {
    let eventId: string | null = null;

    try {
      // Store event in database first
      eventId = await storeWebhookEvent(payload);
    } catch (error) {
      await markEventProcessed(eventId, error as Error);
      throw error;
    }
  },

  // Specific event handlers
  onCheckoutCreated: async (payload) => { },
  onCheckoutUpdated: async (payload) => { },
  onOrderCreated: async (payload) => { },
  onOrderPaid: async (payload) => { },
  onOrderRefunded: async (payload) => { },
  onSubscriptionCreated: async (payload) => { },

  /**
   * subscription.updated - General event that fires for all subscription changes
   * Polar sends BOTH subscription.updated AND specific events (active, canceled, revoked, uncanceled)
   * We skip processing here for statuses that have dedicated handlers to avoid duplicates
   */
  onSubscriptionUpdated: async (payload) => {
    // Skip processing for statuses that have dedicated handlers
    // This prevents duplicate notifications when Polar sends both events
    const status = payload.data?.status;
    if (status === "active" || status === "canceled" || status === "revoked" || status === "uncanceled") {
      // Let the specific handlers process these - do nothing here
      return;
    }

    // For any other status changes, we could add handling here if needed
    // Currently, we only care about the specific events above
  },

  /**
   * subscription.active
   * Sent when subscription becomes active (new paid subscription or payment recovered)
   * - Activate hominio identity
   * - Clear expiration date
   * - Send notification if new purchase
   */
  onSubscriptionActive: async (payload) => {
    try {
      const userInfo = extractUserInfo(payload);
      if (!userInfo) {
        console.error("[Polar Webhook] subscription.active: No externalId found in customer data");
        return;
      }

      const { userId, subscriptionId } = userInfo;
      const zeroDb = getZeroDbInstance();
      const now = new Date().toISOString();
      const { hominioIdentity } = await getIdentities(userId);

      const hominioPackage = {
        packageType: "hominio",
        votingWeight: 1,
        name: "❤︎ I am Hominio",
        price: 1200,
      };

      let identityCreated = false;
      let identityId: string;

      if (!hominioIdentity) {
        // Create new hominio identity
        identityId = nanoid();
        await zeroDb
          .insertInto("userIdentities")
          .values({
            id: identityId,
            userId,
            identityType: hominioPackage.packageType,
            votingWeight: hominioPackage.votingWeight,
            selectedAt: now,
            upgradedFrom: null,
            expiresAt: null,
            subscriptionId: subscriptionId || null,
          })
          .execute();
        identityCreated = true;
      } else {
        // Update existing identity - clear expiration and update subscription ID
        identityId = hominioIdentity.id;
        await zeroDb
          .updateTable("userIdentities")
          .set({
            selectedAt: now,
            expiresAt: null,
            subscriptionId: subscriptionId || hominioIdentity.subscriptionId || null,
          })
          .where("id", "=", identityId)
          .execute();
      }

      // Create purchase record and notification if identity was created
      if (identityCreated) {
        const purchaseId = nanoid();
        await zeroDb
          .insertInto("identityPurchase")
          .values({
            id: purchaseId,
            userId,
            identityType: hominioPackage.packageType,
            price: hominioPackage.price,
            purchasedAt: now,
            userIdentityId: identityId,
          })
          .execute();

        await createNotification(
          userId,
          subscriptionId || "",
          "Purchase Successful! 🎉",
          "Your purchase was successful! You can now vote and participate in all cups. Have fun!",
          "Start Voting",
          "/alpha"
        );
      }

      await markEventProcessedByPayload(payload);
    } catch (error) {
      console.error("[Polar Webhook] subscription.active: Error processing event:", error);
    }
  },

  /**
   * subscription.revoked
   * Sent when subscription is revoked - user loses access IMMEDIATELY
   * Happens when subscription is canceled OR payment is past due
   * - Delete hominio identity immediately
   * - Ensure explorer identity exists
   * - Send notification
   */
  onSubscriptionRevoked: async (payload) => {
    try {
      const userInfo = extractUserInfo(payload);
      if (!userInfo) {
        console.error("[Polar Webhook] subscription.revoked: No externalId found in customer data");
        return;
      }

      const { userId, subscriptionId } = userInfo;
      const { hominioIdentity } = await getIdentities(userId);

      if (!hominioIdentity) {
        // No hominio identity to revoke
        await markEventProcessedByPayload(payload);
        return;
      }

      // Ensure explorer identity exists
      await ensureExplorerIdentity(userId, "hominio");

      // Delete hominio identity immediately
      const zeroDb = getZeroDbInstance();
      await zeroDb
        .deleteFrom("userIdentities")
        .where("id", "=", hominioIdentity.id)
        .execute();

      // Send notification
      await createNotification(
        userId,
        subscriptionId || "",
        "Subscription Revoked",
        "Your subscription has been revoked. Your voting access has ended immediately. Please renew to continue voting on projects."
      );

      await markEventProcessedByPayload(payload);
    } catch (error) {
      console.error("[Polar Webhook] subscription.revoked: Error processing event:", error);
    }
  },

  /**
   * subscription.canceled
   * Sent when subscription is canceled
   * Customers might still have access until the end of the current period
   * - Set expiration date to currentPeriodEnd
   * - Send notification with expiration date
   */
  onSubscriptionCanceled: async (payload) => {
    try {
      const userInfo = extractUserInfo(payload);
      if (!userInfo) {
        console.error("[Polar Webhook] subscription.canceled: No externalId found in customer data");
        return;
      }

      const { userId, subscriptionId, currentPeriodEnd } = userInfo;
      const { hominioIdentity } = await getIdentities(userId);

      if (!hominioIdentity) {
        // No hominio identity to cancel
        await markEventProcessedByPayload(payload);
        return;
      }

      const now = new Date().toISOString();
      const expirationDate = currentPeriodEnd || now;
      const expirationDateObj = new Date(expirationDate);
      const nowDate = new Date(now);

      // Check if cancellation is effective immediately
      const isImmediate = !currentPeriodEnd || expirationDateObj <= nowDate;

      if (isImmediate) {
        // Immediate cancellation - downgrade to explorer
        await ensureExplorerIdentity(userId, "hominio");

        const zeroDb = getZeroDbInstance();
        await zeroDb
          .deleteFrom("userIdentities")
          .where("id", "=", hominioIdentity.id)
          .execute();

        await createNotification(
          userId,
          subscriptionId || "",
          "Subscription Canceled",
          "Your subscription has been canceled. Your voting access has ended. Please renew to continue voting on projects."
        );
      } else {
        // Future expiration - set expiration date
        const zeroDb = getZeroDbInstance();
        await zeroDb
          .updateTable("userIdentities")
          .set({
            expiresAt: expirationDate,
          })
          .where("id", "=", hominioIdentity.id)
          .execute();

        // Send notification with expiration date
        const expirationDateFormatted = expirationDateObj.toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });

        await createNotification(
          userId,
          subscriptionId || "",
          "Subscription Canceled",
          `Your subscription has been canceled. Your voting access will remain active until ${expirationDateFormatted} (end of your paid period). After that, you'll need to renew to continue voting.`,
          "Renew Subscription",
          "/alpha/purchase",
          "renew_subscription" // Custom action type for direct renewal
        );
      }

      await markEventProcessedByPayload(payload);
    } catch (error) {
      console.error("[Polar Webhook] subscription.canceled: Error processing event:", error);
    }
  },

  /**
   * subscription.uncanceled
   * Sent when subscription is uncanceled
   * - Clear expiration date
   * - Activate identity
   * - Send notification
   */
  onSubscriptionUncanceled: async (payload) => {
    try {
      const userInfo = extractUserInfo(payload);
      if (!userInfo) {
        console.error("[Polar Webhook] subscription.uncanceled: No externalId found in customer data");
        return;
      }

      const { userId, subscriptionId } = userInfo;
      const { hominioIdentity } = await getIdentities(userId);
      const now = new Date().toISOString();

      if (!hominioIdentity) {
        // No hominio identity - create one
        const zeroDb = getZeroDbInstance();
        const identityId = nanoid();
        await zeroDb
          .insertInto("userIdentities")
          .values({
            id: identityId,
            userId,
            identityType: "hominio",
            votingWeight: 1,
            selectedAt: now,
            upgradedFrom: null,
            expiresAt: null,
            subscriptionId: subscriptionId || null,
          })
          .execute();

        await createNotification(
          userId,
          subscriptionId || "",
          "Subscription Reactivated! 🎉",
          "Your subscription has been reactivated! Your voting access has been restored. Welcome back!",
          "Start Voting",
          "/alpha"
        );
      } else {
        // Update existing identity - clear expiration
        const wasExpired = hominioIdentity.expiresAt && new Date(hominioIdentity.expiresAt) <= new Date(now);

        const zeroDb = getZeroDbInstance();
        await zeroDb
          .updateTable("userIdentities")
          .set({
            selectedAt: now,
            expiresAt: null,
            subscriptionId: subscriptionId || hominioIdentity.subscriptionId || null,
          })
          .where("id", "=", hominioIdentity.id)
          .execute();

        // Send notification
        const message = wasExpired
          ? "Your subscription has been reactivated! Your voting access has been restored. Welcome back!"
          : "Your subscription has been reactivated! Your voting access continues uninterrupted.";

        await createNotification(
          userId,
          subscriptionId || "",
          "Subscription Reactivated! 🎉",
          message,
          wasExpired ? "Start Voting" : "Continue Voting",
          "/alpha"
        );
      }

      await markEventProcessedByPayload(payload);
    } catch (error) {
      console.error("[Polar Webhook] subscription.uncanceled: Error processing event:", error);
    }
  },

  onCustomerCreated: async (payload) => { },
  onCustomerUpdated: async (payload) => { },
  onCustomerDeleted: async (payload) => { },
  onCustomerStateChanged: async (payload) => { },
  onBenefitCreated: async (payload) => { },
  onBenefitUpdated: async (payload) => { },
  onBenefitGrantCreated: async (payload) => { },
  onBenefitGrantUpdated: async (payload) => { },
  onBenefitGrantRevoked: async (payload) => { },
  onProductCreated: async (payload) => { },
  onProductUpdated: async (payload) => { },
  onRefundCreated: async (payload) => { },
  onRefundUpdated: async (payload) => { },
  onOrganizationUpdated: async (payload) => { },
};

// Wrap the handler to catch and log errors for debugging
export const POST = async (event) => {
  // Get secret at request time (not module load time)
  const SECRET_POLAR_WEBHOOK_SECRET = env.SECRET_POLAR_WEBHOOK_SECRET;

  // Check if secret is set
  if (!SECRET_POLAR_WEBHOOK_SECRET) {
    return json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  // Create the webhook handler with the secret
  const webhookHandler = Webhooks({
    webhookSecret: SECRET_POLAR_WEBHOOK_SECRET,
    ...webhookConfig,
  });

  try {
    const response = await webhookHandler(event);
    return response;
  } catch (error) {
    // Check if it's a signature verification error
    if (error?.message?.includes("signature") ||
      error?.message?.includes("Invalid") ||
      error?.message?.includes("Secret") ||
      error?.name === "WebhookVerificationError") {
      return json({ error: "Invalid signature" }, { status: 401 });
    }

    return json({ error: "Webhook processing failed", message: error?.message }, { status: 500 });
  }
};
