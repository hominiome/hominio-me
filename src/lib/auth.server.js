import { betterAuth } from "better-auth";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { getRequestEvent } from "$app/server";
import { env } from "$env/dynamic/private";
import { getAuthDb } from "$lib/db.server.js";
import { getTrustedOrigins } from "$lib/utils/domain.js";
import { polar, webhooks, checkout } from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";

// Get environment variables at runtime (not build time)
const SECRET_GOOGLE_CLIENT_ID = env.SECRET_GOOGLE_CLIENT_ID || "";
const SECRET_GOOGLE_CLIENT_SECRET = env.SECRET_GOOGLE_CLIENT_SECRET || "";
const SECRET_AUTH_SECRET =
  env.SECRET_AUTH_SECRET || "dev-secret-key-change-in-production";
const SECRET_POLAR_API_KEY = env.SECRET_POLAR_API_KEY || "";
const SECRET_POLAR_WEBHOOK_SECRET = env.SECRET_POLAR_WEBHOOK_SECRET || "";

// Detect environment - only use secure cookies in production
const isProduction = process.env.NODE_ENV === "production";

// Get the database instance - ensure it's the real one, not a stub
// If building and env vars aren't available, Better Auth won't be used anyway
const authDb = getAuthDb();

// Initialize Polar client if API key is provided
// Only configure Polar if credentials are provided to prevent build-time errors
// Automatically use sandbox in development, production in production
const polarClient = SECRET_POLAR_API_KEY
  ? new Polar({
      accessToken: SECRET_POLAR_API_KEY,
      server: isProduction ? undefined : "sandbox", // Sandbox in dev, production in prod (undefined = production)
    })
  : null;

// BetterAuth configuration with explicit database setup
// baseURL and trustedOrigins configured for cross-subdomain cookie sharing
// Cookies will be set for .hominio.me (parent domain) to work across subdomains
// DNS-level redirect handles www → non-www
export const auth = betterAuth({
  database: {
    db: authDb,
    type: "postgres",
  },
  secret: SECRET_AUTH_SECRET,
  // Don't set baseURL - let BetterAuth auto-detect from request origin
  // Trusted origins for CORS and cookie sharing (includes sync subdomain)
  trustedOrigins: getTrustedOrigins(),
  // Only configure Google provider if credentials are provided
  // This prevents warnings during build time when env vars aren't available
  ...(SECRET_GOOGLE_CLIENT_ID && SECRET_GOOGLE_CLIENT_SECRET
    ? {
        socialProviders: {
          google: {
            clientId: SECRET_GOOGLE_CLIENT_ID,
            clientSecret: SECRET_GOOGLE_CLIENT_SECRET,
          },
        },
      }
    : {}),
  plugins: [
    sveltekitCookies(getRequestEvent),
    // Polar plugin - automatically creates customers on signup
    ...(polarClient
      ? [
          polar({
            client: polarClient,
            createCustomerOnSignUp: true, // Automatically sync user accounts with Polar
            use: [
              // Checkout plugin - enable Polar checkout flow
              checkout({
                products: [
                  {
                    productId: "aa8e6119-7f7f-4ce3-abde-666720be9fb3",
                    slug: "I-am-Hominio", // Custom slug for easy reference in Checkout URL
                  },
                ],
                successUrl: "/alpha/polar-test/success?checkout_id={CHECKOUT_ID}",
                authenticatedUsersOnly: true, // Require user to be logged in
              }),
              // Webhooks plugin - handle Polar webhook events
              // Webhook endpoint is automatically available at: /api/auth/polar/webhooks
              ...(SECRET_POLAR_WEBHOOK_SECRET
                ? [
                    webhooks({
                      secret: SECRET_POLAR_WEBHOOK_SECRET,
                      // Catch-all handler for any webhook event (logs first, then specific handlers run)
                      onPayload: (payload) => {
                        console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
                        console.log("🔔 [Polar Webhook] Received Event");
                        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
                        console.log("📅 Timestamp:", new Date().toISOString());
                        console.log("📦 Event Type:", payload.type);
                        console.log("📋 Full Payload:", JSON.stringify(payload, null, 2));
                        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
                      },
                      // Specific event handlers (more detailed logging per event type)
                      onCheckoutCreated: (payload) => {
                        console.log("🛒 [Polar Webhook] Checkout Created");
                        console.log("   Checkout ID:", payload.data?.id);
                        console.log("   Customer ID:", payload.data?.customer_id);
                        console.log("   Status:", payload.data?.status);
                      },
                      onCheckoutUpdated: (payload) => {
                        console.log("🛒 [Polar Webhook] Checkout Updated");
                        console.log("   Checkout ID:", payload.data?.id);
                        console.log("   Status:", payload.data?.status);
                      },
                      onOrderCreated: (payload) => {
                        console.log("📦 [Polar Webhook] Order Created");
                        console.log("   Order ID:", payload.data?.id);
                        console.log("   Customer ID:", payload.data?.customer_id);
                        console.log("   Amount:", payload.data?.amount_total, payload.data?.currency);
                      },
                      onOrderPaid: (payload) => {
                        console.log("💰 [Polar Webhook] Order Paid");
                        console.log("   Order ID:", payload.data?.id);
                        console.log("   Customer ID:", payload.data?.customer_id);
                        console.log("   Amount:", payload.data?.amount_total, payload.data?.currency);
                        console.log("   Products:", payload.data?.items?.map((item) => item.product?.name).join(", "));
                      },
                      onOrderRefunded: (payload) => {
                        console.log("↩️  [Polar Webhook] Order Refunded");
                        console.log("   Order ID:", payload.data?.id);
                        console.log("   Refund Amount:", payload.data?.amount_total, payload.data?.currency);
                      },
                      onSubscriptionCreated: (payload) => {
                        console.log("📋 [Polar Webhook] Subscription Created");
                        console.log("   Subscription ID:", payload.data?.id);
                        console.log("   Customer ID:", payload.data?.customer_id);
                        console.log("   Product ID:", payload.data?.product_id);
                        console.log("   Status:", payload.data?.status);
                      },
                      onSubscriptionUpdated: (payload) => {
                        console.log("📋 [Polar Webhook] Subscription Updated");
                        console.log("   Subscription ID:", payload.data?.id);
                        console.log("   Status:", payload.data?.status);
                      },
                      onSubscriptionActive: (payload) => {
                        console.log("✅ [Polar Webhook] Subscription Active");
                        console.log("   Subscription ID:", payload.data?.id);
                        console.log("   Customer ID:", payload.data?.customer_id);
                        console.log("   Product ID:", payload.data?.product_id);
                        console.log("   Current Period End:", payload.data?.current_period_end);
                      },
                      onSubscriptionCanceled: (payload) => {
                        console.log("❌ [Polar Webhook] Subscription Canceled");
                        console.log("   Subscription ID:", payload.data?.id);
                        console.log("   Customer ID:", payload.data?.customer_id);
                        console.log("   Cancel At:", payload.data?.cancel_at);
                      },
                      onSubscriptionRevoked: (payload) => {
                        console.log("🚫 [Polar Webhook] Subscription Revoked");
                        console.log("   Subscription ID:", payload.data?.id);
                        console.log("   Customer ID:", payload.data?.customer_id);
                      },
                      onSubscriptionUncanceled: (payload) => {
                        console.log("🔄 [Polar Webhook] Subscription Uncanceled");
                        console.log("   Subscription ID:", payload.data?.id);
                        console.log("   Customer ID:", payload.data?.customer_id);
                      },
                      onCustomerCreated: (payload) => {
                        console.log("👤 [Polar Webhook] Customer Created");
                        console.log("   Customer ID:", payload.data?.id);
                        console.log("   Email:", payload.data?.email);
                        console.log("   External ID:", payload.data?.external_id);
                      },
                      onCustomerUpdated: (payload) => {
                        console.log("👤 [Polar Webhook] Customer Updated");
                        console.log("   Customer ID:", payload.data?.id);
                        console.log("   Email:", payload.data?.email);
                      },
                      onCustomerDeleted: (payload) => {
                        console.log("🗑️  [Polar Webhook] Customer Deleted");
                        console.log("   Customer ID:", payload.data?.id);
                      },
                      onCustomerStateChanged: (payload) => {
                        console.log("🔄 [Polar Webhook] Customer State Changed");
                        console.log("   Customer ID:", payload.data?.customer?.id);
                        console.log("   Active Subscriptions:", payload.data?.subscriptions?.length || 0);
                        console.log("   Granted Benefits:", payload.data?.benefits?.length || 0);
                      },
                      onBenefitCreated: (payload) => {
                        console.log("🎁 [Polar Webhook] Benefit Created");
                        console.log("   Benefit ID:", payload.data?.id);
                        console.log("   Type:", payload.data?.type);
                        console.log("   Description:", payload.data?.description);
                      },
                      onBenefitUpdated: (payload) => {
                        console.log("🎁 [Polar Webhook] Benefit Updated");
                        console.log("   Benefit ID:", payload.data?.id);
                      },
                      onBenefitGrantCreated: (payload) => {
                        console.log("🎁 [Polar Webhook] Benefit Grant Created");
                        console.log("   Grant ID:", payload.data?.id);
                        console.log("   Customer ID:", payload.data?.customer_id);
                        console.log("   Benefit ID:", payload.data?.benefit_id);
                      },
                      onBenefitGrantUpdated: (payload) => {
                        console.log("🎁 [Polar Webhook] Benefit Grant Updated");
                        console.log("   Grant ID:", payload.data?.id);
                      },
                      onBenefitGrantRevoked: (payload) => {
                        console.log("🎁 [Polar Webhook] Benefit Grant Revoked");
                        console.log("   Grant ID:", payload.data?.id);
                        console.log("   Customer ID:", payload.data?.customer_id);
                      },
                      onProductCreated: (payload) => {
                        console.log("🛍️  [Polar Webhook] Product Created");
                        console.log("   Product ID:", payload.data?.id);
                        console.log("   Name:", payload.data?.name);
                      },
                      onProductUpdated: (payload) => {
                        console.log("🛍️  [Polar Webhook] Product Updated");
                        console.log("   Product ID:", payload.data?.id);
                        console.log("   Name:", payload.data?.name);
                      },
                      onRefundCreated: (payload) => {
                        console.log("↩️  [Polar Webhook] Refund Created");
                        console.log("   Refund ID:", payload.data?.id);
                        console.log("   Order ID:", payload.data?.order_id);
                        console.log("   Amount:", payload.data?.amount, payload.data?.currency);
                      },
                      onRefundUpdated: (payload) => {
                        console.log("↩️  [Polar Webhook] Refund Updated");
                        console.log("   Refund ID:", payload.data?.id);
                        console.log("   Status:", payload.data?.status);
                      },
                      onOrganizationUpdated: (payload) => {
                        console.log("🏢 [Polar Webhook] Organization Updated");
                        console.log("   Organization ID:", payload.data?.id);
                        console.log("   Name:", payload.data?.name);
                      },
                    }),
                  ]
                : []),
            ],
          }),
        ]
      : []),
  ],
  advanced: {
    // Enable cross-subdomain cookies ONLY in production (for Zero sync)
    // BetterAuth automatically sets cookies for .hominio.me with SameSite=Lax
    // This makes cookies accessible from hominio.me and sync.hominio.me (but NOT other domains)
    // Zero requires cookies to be accessible from both hominio.me and sync.hominio.me
    // In development (localhost), we don't need cross-subdomain cookies
    ...(isProduction
      ? {
          crossSubDomainCookies: {
            enabled: true,
            domain: "hominio.me", // Root domain (BetterAuth automatically adds dot prefix: .hominio.me)
          },
        }
      : {}),
    // Force secure cookies (HTTPS only) ONLY in production
    // In development (localhost), allow HTTP cookies for local testing
    useSecureCookies: isProduction,
    // Default cookie attributes - httpOnly prevents JavaScript access (XSS protection)
    // secure is set conditionally based on environment (production = true, dev = false)
    // sameSite is automatically set to 'lax' by crossSubDomainCookies in production
    defaultCookieAttributes: {
      httpOnly: true, // Prevent JavaScript access (XSS protection) - always enabled
      secure: isProduction, // HTTPS only in production, allow HTTP in development
    },
  },
});
