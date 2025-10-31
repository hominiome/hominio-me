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
  SECRET_AUTH_SECRET,
} from "$env/static/private";
import { dev } from "$app/environment";

// Initialize Kysely with Neon dialect
const db = new Kysely({
  dialect: new NeonDialect({
    neon: neon(SECRET_NEON_PG_AUTH),
  }),
});

// Auth secret
const authSecret = SECRET_AUTH_SECRET || "dev-secret-key-change-in-production";

// BetterAuth configuration with explicit database setup
// Note: No baseURL specified - better-auth will use the current request origin
// This allows it to work on both hominio.me and www.hominio.me
export const auth = betterAuth({
  database: {
    db,
    type: "postgres",
  },
  secret: authSecret,
  socialProviders: {
    google: {
      clientId: SECRET_GOOGLE_CLIENT_ID || "",
      clientSecret: SECRET_GOOGLE_CLIENT_SECRET || "",
    },
  },
  plugins: [sveltekitCookies(getRequestEvent)],
});
