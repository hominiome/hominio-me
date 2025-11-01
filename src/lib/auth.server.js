import { betterAuth } from "better-auth";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { getRequestEvent } from "$app/server";
import { env } from "$env/dynamic/private";
import { authDb } from "$lib/db.server.js";

// Get environment variables at runtime (not build time)
const SECRET_GOOGLE_CLIENT_ID = env.SECRET_GOOGLE_CLIENT_ID || "";
const SECRET_GOOGLE_CLIENT_SECRET = env.SECRET_GOOGLE_CLIENT_SECRET || "";
const SECRET_AUTH_SECRET =
  env.SECRET_AUTH_SECRET || "dev-secret-key-change-in-production";

// BetterAuth configuration with explicit database setup
// Note: No baseURL specified - better-auth will use the current request origin
// This allows it to work on both hominio.me and www.hominio.me
export const auth = betterAuth({
  database: {
    db: authDb,
    type: "postgres",
  },
  secret: SECRET_AUTH_SECRET,
  socialProviders: {
    google: {
      clientId: SECRET_GOOGLE_CLIENT_ID,
      clientSecret: SECRET_GOOGLE_CLIENT_SECRET,
    },
  },
  plugins: [sveltekitCookies(getRequestEvent)],
});
