import { betterAuth } from "better-auth";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { Kysely } from "kysely";
import { NeonDialect } from "kysely-neon";
import { neon } from "@neondatabase/serverless";
import { getRequestEvent } from "$app/server";
import { env } from "$env/dynamic/private";
import { dev } from "$app/environment";

// Initialize Kysely with Neon dialect
// env vars are only available at runtime (not during build)
const db = new Kysely({
  dialect: new NeonDialect({
    neon: neon(env.SECRET_NEON_PG_AUTH || ""),
  }),
});

// Determine base URL
const baseURL = dev
  ? "http://localhost:5173"
  : "https://hominio.me";

// Generate a secret for dev (in production, use SECRET_AUTH_SECRET env var)
const authSecret = dev
  ? "dev-secret-key-change-in-production"
  : env.SECRET_AUTH_SECRET || "fallback-secret-please-set-env-var";

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
      clientId: env.SECRET_GOOGLE_CLIENT_ID || "",
      clientSecret: env.SECRET_GOOGLE_CLIENT_SECRET || "",
    },
  },
  // SvelteKit cookies plugin (must be last in plugins array)
  plugins: [sveltekitCookies(getRequestEvent)],
});

