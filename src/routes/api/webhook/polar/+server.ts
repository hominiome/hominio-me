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
  
  // Specific event handlers (empty - events are stored via onPayload)
  onCheckoutCreated: async (payload) => {},
  onCheckoutUpdated: async (payload) => {},
  onOrderCreated: async (payload) => {},
  onOrderPaid: async (payload) => {},
  onOrderRefunded: async (payload) => {},
  onSubscriptionCreated: async (payload) => {},
  onSubscriptionUpdated: async (payload) => {},
  onSubscriptionActive: async (payload) => {},
  onSubscriptionCanceled: async (payload) => {},
  onSubscriptionRevoked: async (payload) => {},
  onSubscriptionUncanceled: async (payload) => {},
  onCustomerCreated: async (payload) => {},
  onCustomerUpdated: async (payload) => {},
  onCustomerDeleted: async (payload) => {},
  onCustomerStateChanged: async (payload) => {},
  onBenefitCreated: async (payload) => {},
  onBenefitUpdated: async (payload) => {},
  onBenefitGrantCreated: async (payload) => {},
  onBenefitGrantUpdated: async (payload) => {},
  onBenefitGrantRevoked: async (payload) => {},
  onProductCreated: async (payload) => {},
  onProductUpdated: async (payload) => {},
  onRefundCreated: async (payload) => {},
  onRefundUpdated: async (payload) => {},
  onOrganizationUpdated: async (payload) => {},
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

