import { Webhooks } from "@polar-sh/sveltekit";
import { env } from "$env/dynamic/private";
import { json } from "@sveltejs/kit";

/**
 * Polar Webhook Endpoint
 * Native SvelteKit adapter for Polar webhooks
 * Handles signature verification and routes to event handlers
 * 
 * Endpoint: /api/webhook/polar
 * Configure this URL in Polar Dashboard: https://hominio-me.loca.lt/api/webhook/polar
 */

// Create webhook handlers configuration
const webhookConfig = {
  
  // Catch-all handler for any webhook event
  onPayload: async (payload) => {
    try {
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔔 [Polar Webhook] Received Event");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📅 Timestamp:", new Date().toISOString());
    console.log("📦 Event Type:", payload.type);
    console.log("📋 Full Payload:", JSON.stringify(payload, null, 2));
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    } catch (error) {
      console.error("[Polar Webhook] Error in onPayload handler:", error);
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

