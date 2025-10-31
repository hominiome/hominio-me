import { betterAuth } from "better-auth";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { Kysely } from "kysely";
import { NeonDialect } from "kysely-neon";
import { neon } from "@neondatabase/serverless";
import { getRequestEvent } from "$app/server";
import { env } from "$env/dynamic/private";
import { dev } from "$app/environment";

// Lazy initialization - only create auth instance at runtime, not during build
let _auth;

function getAuth() {
  if (_auth) return _auth;

  // Initialize Kysely with Neon dialect (only at runtime)
  const db = new Kysely({
    dialect: new NeonDialect({
      neon: neon(env.SECRET_NEON_PG_AUTH),
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
  _auth = betterAuth({
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

  return _auth;
}

// Export a proxy that initializes auth lazily
export const auth = new Proxy({}, {
  get(target, prop) {
    return getAuth()[prop];
  }
});

