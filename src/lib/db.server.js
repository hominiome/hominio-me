import { Kysely } from "kysely";
import { NeonDialect } from "kysely-neon";
import { neon } from "@neondatabase/serverless";
import { env } from "$env/dynamic/private";
import { building } from "$app/environment";

let _zeroDb = null;
let _authDb = null;

/**
 * Create a stub database object for build time
 */
function createBuildStub() {
  const stub = {};
  // Add common Kysely methods that return the stub itself
  ['selectFrom', 'insertInto', 'updateTable', 'deleteFrom'].forEach(method => {
    stub[method] = () => stub;
  });
  // Add chaining methods
  ['where', 'set', 'values', 'execute', 'executeTakeFirst', 'executeTakeFirstOrThrow'].forEach(method => {
    stub[method] = () => stub;
  });
  return stub;
}

/**
 * Centralized database instance for Zero operations
 * Uses SECRET_ZERO_DEV_PG connection string
 * Lazy initialization to avoid build-time errors
 */
function getZeroDb() {
  // Check if we have the connection string - if not, return stub
  const connectionString = env.SECRET_ZERO_DEV_PG;
  if (!connectionString) {
    // During build, env vars might not be available, so return stub
    if (building) {
      return createBuildStub();
    }
    // At runtime, throw error if connection string is missing
    throw new Error("SECRET_ZERO_DEV_PG environment variable is required");
  }
  
  // If we have connection string, create real instance
  // Check if cached instance is a stub - stubs don't have Kysely's internal structure
  // A real Kysely instance will have selectFrom, insertInto, etc. as proper methods
  const isStub = !_zeroDb || 
                 typeof _zeroDb.selectFrom !== 'function' ||
                 typeof _zeroDb.insertInto !== 'function' ||
                 !building && connectionString && (!_zeroDb || Object.keys(_zeroDb).length === 0);
  
  if (isStub) {
    _zeroDb = new Kysely({
      dialect: new NeonDialect({
        neon: neon(connectionString),
      }),
    });
  }
  return _zeroDb;
}

/**
 * Centralized database instance for auth operations
 * Uses SECRET_NEON_PG_AUTH connection string (same as auth.server.js)
 * This is the same database as used by BetterAuth
 * Lazy initialization to avoid build-time errors
 */
export function getAuthDb() {
  // Check if we have the connection string - if not, return stub
  const connectionString = env.SECRET_NEON_PG_AUTH;
  if (!connectionString) {
    // During build, env vars might not be available, so return stub
    if (building) {
      return createBuildStub();
    }
    // At runtime, throw error if connection string is missing
    throw new Error("SECRET_NEON_PG_AUTH environment variable is required");
  }
  
  // If we have connection string, create real instance
  // Check if cached instance is a stub - stubs don't have Kysely's internal structure
  // A real Kysely instance will have selectFrom, insertInto, etc. as proper methods
  const isStub = !_authDb || 
                 typeof _authDb.selectFrom !== 'function' ||
                 typeof _authDb.insertInto !== 'function' ||
                 !building && connectionString && (!_authDb || Object.keys(_authDb).length === 0);
  
  if (isStub) {
    _authDb = new Kysely({
      dialect: new NeonDialect({
        neon: neon(connectionString),
      }),
    });
  }
  return _authDb;
}

// Export getter functions for lazy initialization
// This allows callers to get fresh instances that check building/env vars at call time
export function getZeroDbInstance() {
  return getZeroDb();
}

export function getAuthDbInstance() {
  return getAuthDb();
}

// Export direct instances for backward compatibility
// Note: These are evaluated once at module load time
// Use getZeroDbInstance()/getAuthDbInstance() for fresh instances
export const zeroDb = getZeroDb();
export const authDb = getAuthDb();

