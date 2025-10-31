#!/usr/bin/env bun

// Wrapper script to run zero-cache with the correct env vars
// Bun automatically loads .env file

const DATABASE_URL = process.env.SECRET_ZERO_DEV_PG;

if (!DATABASE_URL) {
  console.error("❌ SECRET_ZERO_DEV_PG environment variable is required");
  console.error(
    "💡 Make sure you have a .env file with SECRET_ZERO_DEV_PG set"
  );
  process.exit(1);
}

// Set ZERO_UPSTREAM_DB from our SECRET_ZERO_DEV_PG
process.env.ZERO_UPSTREAM_DB = DATABASE_URL;

// Also set ZERO_REPLICA_FILE if not already set
if (!process.env.ZERO_REPLICA_FILE) {
  process.env.ZERO_REPLICA_FILE = "./zero-replica.db";
}

// Set Zero auth secret for JWT validation
const ZERO_AUTH_SECRET = process.env.SECRET_ZERO_AUTH_SECRET;
if (!ZERO_AUTH_SECRET) {
  console.error("❌ SECRET_ZERO_AUTH_SECRET environment variable is required");
  console.error(
    "💡 Make sure you have a .env file with SECRET_ZERO_AUTH_SECRET set"
  );
  process.exit(1);
}
process.env.ZERO_AUTH_SECRET = ZERO_AUTH_SECRET;

// Run zero-cache-dev with the schema path
const { spawnSync } = require("child_process");

const result = spawnSync(
  "zero-cache-dev",
  ["--schema-path=./src/zero-schema.ts"],
  {
    stdio: "inherit",
    env: process.env,
  }
);

process.exit(result.status || 0);

