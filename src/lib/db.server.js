import { Kysely } from "kysely";
import { NeonDialect } from "kysely-neon";
import { neon } from "@neondatabase/serverless";
import { env } from "$env/dynamic/private";

/**
 * Centralized database instance for Zero operations
 * Uses SECRET_ZERO_DEV_PG connection string
 */
export const zeroDb = new Kysely({
  dialect: new NeonDialect({
    neon: neon(env.SECRET_ZERO_DEV_PG),
  }),
});

/**
 * Centralized database instance for auth operations
 * Uses SECRET_NEON_PG_AUTH connection string (same as auth.server.js)
 * This is the same database as used by BetterAuth
 */
export const authDb = new Kysely({
  dialect: new NeonDialect({
    neon: neon(env.SECRET_NEON_PG_AUTH),
  }),
});

