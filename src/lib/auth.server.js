import { betterAuth } from "better-auth";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { getRequestEvent } from "$app/server";
import { env } from "$env/dynamic/private";
import { env as publicEnv } from "$env/dynamic/public";
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
// PUBLIC_ vars are accessible in both client and server
// Fallback to localhost/sandbox product ID if not set (for development)
const PUBLIC_POLAR_PRODUCT_ID_1 =
  publicEnv.PUBLIC_POLAR_PRODUCT_ID_1 || "aa8e6119-7f7f-4ce3-abde-666720be9fb3";

// Detect environment - only use secure cookies in production
const isProduction = process.env.NODE_ENV === "production";

// Get the database instance - ensure it's the real one, not a stub
// If building and env vars aren't available, Better Auth won't be used anyway
const authDb = getAuthDb();

// Initialize Polar client if API key is provided
// Only configure Polar if credentials are provided to prevent build-time errors
// Automatically use sandbox in development, production in production
export const polarClient = SECRET_POLAR_API_KEY
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
              ...(PUBLIC_POLAR_PRODUCT_ID_1
                ? [
                    checkout({
                      products: [
                        {
                          productId: PUBLIC_POLAR_PRODUCT_ID_1,
                          slug: "I-am-Hominio", // Custom slug for easy reference in Checkout URL
                        },
                      ],
                      successUrl: "/alpha",
                      authenticatedUsersOnly: true, // Require user to be logged in
                    }),
                  ]
                : []),
              // Webhooks plugin - handle Polar webhook events
              // Webhook endpoint is automatically available at: /api/auth/polar/webhooks
              ...(SECRET_POLAR_WEBHOOK_SECRET
                ? [
                    webhooks({
                      secret: SECRET_POLAR_WEBHOOK_SECRET,
                      // Event handlers (empty - events are handled by the native SvelteKit adapter)
                      onPayload: (payload) => {},
                      onCheckoutCreated: (payload) => {},
                      onCheckoutUpdated: (payload) => {},
                      onOrderCreated: (payload) => {},
                      onOrderPaid: (payload) => {},
                      onOrderRefunded: (payload) => {},
                      onSubscriptionCreated: (payload) => {},
                      onSubscriptionUpdated: (payload) => {},
                      onSubscriptionActive: (payload) => {},
                      onSubscriptionCanceled: (payload) => {},
                      onSubscriptionRevoked: (payload) => {},
                      onSubscriptionUncanceled: (payload) => {},
                      onCustomerCreated: (payload) => {},
                      onCustomerUpdated: (payload) => {},
                      onCustomerDeleted: (payload) => {},
                      onCustomerStateChanged: (payload) => {},
                      onBenefitCreated: (payload) => {},
                      onBenefitUpdated: (payload) => {},
                      onBenefitGrantCreated: (payload) => {},
                      onBenefitGrantUpdated: (payload) => {},
                      onBenefitGrantRevoked: (payload) => {},
                      onProductCreated: (payload) => {},
                      onProductUpdated: (payload) => {},
                      onRefundCreated: (payload) => {},
                      onRefundUpdated: (payload) => {},
                      onOrganizationUpdated: (payload) => {},
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
