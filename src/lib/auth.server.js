import { betterAuth } from "better-auth";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { Kysely } from "kysely";
import { NeonDialect } from "kysely-neon";
import { neon } from "@neondatabase/serverless";
import { getRequestEvent } from "$app/server";
import {
  SECRET_NEON_PG_AUTH,
  SECRET_GOOGLE_CLIENT_ID,
  SECRET_GOOGLE_CLIENT_SECRET,
} from "$env/static/private";
import { dev } from "$app/environment";

if (!SECRET_NEON_PG_AUTH) {
  throw new Error("SECRET_NEON_PG_AUTH environment variable is required");
}

// Initialize Kysely with Neon dialect
const db = new Kysely({
  dialect: new NeonDialect({
    neon: neon(SECRET_NEON_PG_AUTH),
  }),
});

// Determine base URL
const baseURL = dev
  ? "http://localhost:5173"
  : "https://hominio.me";

// Generate a secret for dev (in production, use SECRET_AUTH_SECRET env var)
const authSecret = dev
  ? "dev-secret-key-change-in-production"
  : process.env.SECRET_AUTH_SECRET || "fallback-secret-please-set-env-var";

// BetterAuth configuration with explicit database setup
export const auth = betterAuth({
  database: {
    db,
    type: "postgres", // Explicitly specify database type
  },
  baseURL,
  secret: authSecret,
  socialProviders: {
    google: {
      clientId: SECRET_GOOGLE_CLIENT_ID || "",
      clientSecret: SECRET_GOOGLE_CLIENT_SECRET || "",
    },
  },
  // SvelteKit cookies plugin (must be last in plugins array)
  plugins: [sveltekitCookies(getRequestEvent)],
});

