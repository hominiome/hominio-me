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
      console.log(`⚠️  [Polar Webhook] Duplicate event detected (${polarEventId}), skipping storage`);
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
    
    console.log(`💾 [Polar Webhook] Stored event ${eventId} (type: ${payload.type}, polar_id: ${polarEventId})`);
    
    return eventId;
  } catch (error: any) {
    // Log error but don't fail webhook processing
    console.error("[Polar Webhook] ❌ Error storing webhook event:", error);
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
    
    if (error) {
      console.error(`❌ [Polar Webhook] Marked event ${eventId} as processed with error`);
    } else {
      console.log(`✅ [Polar Webhook] Marked event ${eventId} as processed successfully`);
    }
  } catch (err) {
    console.error("[Polar Webhook] Error marking event as processed:", err);
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
    
    if (error) {
      console.error(`❌ [Polar Webhook] Marked event (${polarEventId}) as processed with error`);
    } else {
      console.log(`✅ [Polar Webhook] Marked event (${polarEventId}) as processed successfully`);
    }
  } catch (err) {
    console.error("[Polar Webhook] Error marking event as processed:", err);
  }
}

// Create webhook handlers configuration
const webhookConfig = {
  
  // Catch-all handler for any webhook event
  onPayload: async (payload: any) => {
    let eventId: string | null = null;
    
    try {
      // Store event in database first
      eventId = await storeWebhookEvent(payload);
      
      console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("🔔 [Polar Webhook] Received Event");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("📅 Timestamp:", new Date().toISOString());
      console.log("📦 Event Type:", payload.type);
      console.log("💾 Event ID:", eventId || "not stored");
      console.log("📋 Full Payload:", JSON.stringify(payload, null, 2));
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    } catch (error) {
      console.error("[Polar Webhook] Error in onPayload handler:", error);
      await markEventProcessed(eventId, error as Error);
      throw error;
    }
  },
  
  // Specific event handlers
  onCheckoutCreated: async (payload) => {
    console.log("🛒 [Polar Webhook] Checkout Created");
    console.log("   Checkout ID:", payload.data?.id);
    console.log("   Customer ID:", payload.data?.customer_id);
    console.log("   Status:", payload.data?.status);
  },
  
  onCheckoutUpdated: async (payload) => {
    console.log("🛒 [Polar Webhook] Checkout Updated");
    console.log("   Checkout ID:", payload.data?.id);
    console.log("   Status:", payload.data?.status);
  },
  
  onOrderCreated: async (payload) => {
    console.log("📦 [Polar Webhook] Order Created");
    console.log("   Order ID:", payload.data?.id);
    console.log("   Customer ID:", payload.data?.customer_id);
    console.log("   Amount:", payload.data?.amount_total, payload.data?.currency);
  },
  
  onOrderPaid: async (payload) => {
    console.log("💰 [Polar Webhook] Order Paid");
    console.log("   Order ID:", payload.data?.id);
    console.log("   Customer ID:", payload.data?.customer_id);
    console.log("   Amount:", payload.data?.amount_total, payload.data?.currency);
    console.log("   Products:", payload.data?.items?.map((item) => item.product?.name).join(", "));
  },
  
  onOrderRefunded: async (payload) => {
    console.log("↩️  [Polar Webhook] Order Refunded");
    console.log("   Order ID:", payload.data?.id);
    console.log("   Refund Amount:", payload.data?.amount_total, payload.data?.currency);
  },
  
  onSubscriptionCreated: async (payload) => {
    console.log("📋 [Polar Webhook] Subscription Created");
    console.log("   Subscription ID:", payload.data?.id);
    console.log("   Customer ID:", payload.data?.customer_id);
    console.log("   Product ID:", payload.data?.product_id);
    console.log("   Status:", payload.data?.status);
  },
  
  onSubscriptionUpdated: async (payload) => {
    console.log("📋 [Polar Webhook] Subscription Updated");
    console.log("   Subscription ID:", payload.data?.id);
    console.log("   Status:", payload.data?.status);
  },
  
  onSubscriptionActive: async (payload) => {
    console.log("✅ [Polar Webhook] Subscription Active");
    console.log("   Subscription ID:", payload.data?.id);
    console.log("   Customer ID:", payload.data?.customer_id);
    console.log("   Product ID:", payload.data?.product_id);
    console.log("   Current Period End:", payload.data?.current_period_end);
  },
  
  onSubscriptionCanceled: async (payload) => {
    console.log("❌ [Polar Webhook] Subscription Canceled");
    console.log("   Subscription ID:", payload.data?.id);
    console.log("   Customer ID:", payload.data?.customer_id);
    console.log("   Cancel At:", payload.data?.cancel_at);
  },
  
  onSubscriptionRevoked: async (payload) => {
    console.log("🚫 [Polar Webhook] Subscription Revoked");
    console.log("   Subscription ID:", payload.data?.id);
    console.log("   Customer ID:", payload.data?.customer_id);
  },
  
  onSubscriptionUncanceled: async (payload) => {
    console.log("🔄 [Polar Webhook] Subscription Uncanceled");
    console.log("   Subscription ID:", payload.data?.id);
    console.log("   Customer ID:", payload.data?.customer_id);
  },
  
  onCustomerCreated: async (payload) => {
    console.log("👤 [Polar Webhook] Customer Created");
    console.log("   Customer ID:", payload.data?.id);
    console.log("   Email:", payload.data?.email);
    console.log("   External ID:", payload.data?.external_id);
  },
  
  onCustomerUpdated: async (payload) => {
    console.log("👤 [Polar Webhook] Customer Updated");
    console.log("   Customer ID:", payload.data?.id);
    console.log("   Email:", payload.data?.email);
  },
  
  onCustomerDeleted: async (payload) => {
    console.log("🗑️  [Polar Webhook] Customer Deleted");
    console.log("   Customer ID:", payload.data?.id);
  },
  
  onCustomerStateChanged: async (payload) => {
    console.log("🔄 [Polar Webhook] Customer State Changed");
    console.log("   Customer ID:", payload.data?.customer?.id);
    console.log("   Active Subscriptions:", payload.data?.subscriptions?.length || 0);
    console.log("   Granted Benefits:", payload.data?.benefits?.length || 0);
  },
  
  onBenefitCreated: async (payload) => {
    console.log("🎁 [Polar Webhook] Benefit Created");
    console.log("   Benefit ID:", payload.data?.id);
    console.log("   Type:", payload.data?.type);
    console.log("   Description:", payload.data?.description);
  },
  
  onBenefitUpdated: async (payload) => {
    console.log("🎁 [Polar Webhook] Benefit Updated");
    console.log("   Benefit ID:", payload.data?.id);
  },
  
  onBenefitGrantCreated: async (payload) => {
    console.log("🎁 [Polar Webhook] Benefit Grant Created");
    console.log("   Grant ID:", payload.data?.id);
    console.log("   Customer ID:", payload.data?.customer_id);
    console.log("   Benefit ID:", payload.data?.benefit_id);
  },
  
  onBenefitGrantUpdated: async (payload) => {
    console.log("🎁 [Polar Webhook] Benefit Grant Updated");
    console.log("   Grant ID:", payload.data?.id);
  },
  
  onBenefitGrantRevoked: async (payload) => {
    console.log("🎁 [Polar Webhook] Benefit Grant Revoked");
    console.log("   Grant ID:", payload.data?.id);
    console.log("   Customer ID:", payload.data?.customer_id);
  },
  
  onProductCreated: async (payload) => {
    console.log("🛍️  [Polar Webhook] Product Created");
    console.log("   Product ID:", payload.data?.id);
    console.log("   Name:", payload.data?.name);
  },
  
  onProductUpdated: async (payload) => {
    console.log("🛍️  [Polar Webhook] Product Updated");
    console.log("   Product ID:", payload.data?.id);
    console.log("   Name:", payload.data?.name);
  },
  
  onRefundCreated: async (payload) => {
    console.log("↩️  [Polar Webhook] Refund Created");
    console.log("   Refund ID:", payload.data?.id);
    console.log("   Order ID:", payload.data?.order_id);
    console.log("   Amount:", payload.data?.amount, payload.data?.currency);
  },
  
  onRefundUpdated: async (payload) => {
    console.log("↩️  [Polar Webhook] Refund Updated");
    console.log("   Refund ID:", payload.data?.id);
    console.log("   Status:", payload.data?.status);
  },
  
  onOrganizationUpdated: async (payload) => {
    console.log("🏢 [Polar Webhook] Organization Updated");
    console.log("   Organization ID:", payload.data?.id);
    console.log("   Name:", payload.data?.name);
  },
};

// Wrap the handler to catch and log errors for debugging
export const POST = async (event) => {
  // Get secret at request time (not module load time)
  const SECRET_POLAR_WEBHOOK_SECRET = env.SECRET_POLAR_WEBHOOK_SECRET;
  
  // Check if secret is set
  if (!SECRET_POLAR_WEBHOOK_SECRET) {
    console.error("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("[Polar Webhook] ❌ SECRET_POLAR_WEBHOOK_SECRET not set!");
    console.error("[Polar Webhook] Add SECRET_POLAR_WEBHOOK_SECRET to your .env file");
    console.error("[Polar Webhook] Get it from Polar Dashboard → Organization Settings → Webhooks");
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    return json({ error: "Webhook secret not configured" }, { status: 500 });
  }
  
  // Log initialization (only once per request)
  console.log("[Polar Webhook] ✅ Processing webhook");
  console.log("[Polar Webhook] Secret is set:", SECRET_POLAR_WEBHOOK_SECRET ? "Yes" : "No");
  console.log("[Polar Webhook] Secret length:", SECRET_POLAR_WEBHOOK_SECRET?.length || 0);
  console.log("[Polar Webhook] Secret starts with:", SECRET_POLAR_WEBHOOK_SECRET?.substring(0, 8) + "...");
  
  // Create the webhook handler with the secret
  const webhookHandler = Webhooks({
    webhookSecret: SECRET_POLAR_WEBHOOK_SECRET,
    ...webhookConfig,
  });
  
  try {
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("[Polar Webhook] 📥 Incoming webhook request");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Method:", event.request.method);
    console.log("URL:", event.url.toString());
    
    const headers = Object.fromEntries(event.request.headers.entries());
    console.log("Headers:", JSON.stringify(headers, null, 2));
    console.log("Content-Type:", headers['content-type']);
    console.log("Has signature header:", !!headers['polar-signature']);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    
    const response = await webhookHandler(event);
    
    console.log("[Polar Webhook] ✅ Request processed successfully");
    console.log("[Polar Webhook] Response status:", response.status);
    
    // Note: Individual event handlers will mark events as processed
    // The onPayload handler stores the event, and specific handlers can update processed status
    
    return response;
  } catch (error) {
    console.error("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("❌ [Polar Webhook] Error processing webhook");
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("Error name:", error?.name);
    console.error("Error message:", error?.message);
    console.error("Error stack:", error?.stack);
    
    // Check if it's a signature verification error
    if (error?.message?.includes("signature") || 
        error?.message?.includes("Invalid") || 
        error?.message?.includes("Secret") ||
        error?.name === "WebhookVerificationError") {
      console.error("\n⚠️  This looks like a signature verification error.");
      console.error("💡 Make sure SECRET_POLAR_WEBHOOK_SECRET matches the secret in Polar Dashboard.");
      console.error("💡 Check that you're using the correct webhook secret for your environment (sandbox vs production).");
      return json({ error: "Invalid signature" }, { status: 401 });
    }
    
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    return json({ error: "Webhook processing failed", message: error?.message }, { status: 500 });
  }
};

