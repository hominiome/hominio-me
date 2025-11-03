import { betterAuth } from "better-auth";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { getRequestEvent } from "$app/server";
import { env } from "$env/dynamic/private";
import { env as publicEnv } from "$env/dynamic/public";
import { getAuthDb } from "$lib/db.server.js";

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
// For production, accept both hominio.me and www.hominio.me
const baseURL = publicEnv.PUBLIC_BASE_URL || undefined;

export const auth = betterAuth({
  database: {
    db: authDb,
    type: "postgres",
  },
  secret: SECRET_AUTH_SECRET,
  // Don't set baseURL - let BetterAuth auto-detect from request origin
  // This allows both hominio.me and www.hominio.me to work
  // Trusted origins for CORS and cookie sharing
  trustedOrigins: baseURL ? [
    baseURL,
    baseURL.replace('https://', 'https://www.'), // www subdomain
    baseURL.replace('https://', 'https://sync.'), // sync subdomain
  ] : [
    'https://hominio.me',
    'https://www.hominio.me',
    'https://sync.hominio.me',
  ],
  socialProviders: {
    google: {
      clientId: SECRET_GOOGLE_CLIENT_ID,
      clientSecret: SECRET_GOOGLE_CLIENT_SECRET,
    },
  },
  plugins: [sveltekitCookies(getRequestEvent)],
});
