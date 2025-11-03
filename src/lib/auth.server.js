import { betterAuth } from "better-auth";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { getRequestEvent } from "$app/server";
import { env } from "$env/dynamic/private";
import { getAuthDb } from "$lib/db.server.js";
import { getTrustedOrigins } from "$lib/utils/domain.js";

// Get environment variables at runtime (not build time)
const SECRET_GOOGLE_CLIENT_ID = env.SECRET_GOOGLE_CLIENT_ID || "";
const SECRET_GOOGLE_CLIENT_SECRET = env.SECRET_GOOGLE_CLIENT_SECRET || "";
const SECRET_AUTH_SECRET =
  env.SECRET_AUTH_SECRET || "dev-secret-key-change-in-production";

// Get the database instance - ensure it's the real one, not a stub
// If building and env vars aren't available, Better Auth won't be used anyway
const authDb = getAuthDb();

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
  plugins: [sveltekitCookies(getRequestEvent)],
  advanced: {
    // Enable cross-subdomain cookies for Zero sync (REQUIRED by Zero docs)
    // BetterAuth automatically sets cookies for .hominio.me with SameSite=Lax
    // This makes cookies accessible from hominio.me and sync.hominio.me (but NOT other domains)
    // Zero requires cookies to be accessible from both hominio.me and sync.hominio.me
    crossSubDomainCookies: {
      enabled: true,
      domain: 'hominio.me', // Root domain (BetterAuth automatically adds dot prefix: .hominio.me)
    },
    // Force secure cookies (HTTPS only) - REQUIRED for production
    // Ensures cookies are only sent over HTTPS connections
    useSecureCookies: true,
    // Default cookie attributes - httpOnly prevents JavaScript access (XSS protection)
    // secure is handled by useSecureCookies above, but explicit here for clarity
    // sameSite is automatically set to 'lax' by crossSubDomainCookies
    defaultCookieAttributes: {
      httpOnly: true, // Prevent JavaScript access (XSS protection)
      secure: true,   // HTTPS only (redundant with useSecureCookies but explicit)
    },
  },
});
