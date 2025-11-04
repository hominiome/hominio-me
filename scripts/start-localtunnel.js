#!/usr/bin/env node

/**
 * Starts localtunnel with a deterministic subdomain for local development
 * This allows Polar webhooks to reach the local development server
 */

import { spawn } from "child_process";

const PORT = process.env.PORT || 5173;
const SUBDOMAIN = "hominio-me";

console.log(`[Localtunnel] Starting tunnel to http://localhost:${PORT}...`);
console.log(`[Localtunnel] Subdomain: ${SUBDOMAIN}`);
console.log(`[Localtunnel] URL will be: https://${SUBDOMAIN}.loca.lt`);

const tunnel = spawn("lt", ["--port", PORT.toString(), "--subdomain", SUBDOMAIN], {
  stdio: "inherit",
  shell: true,
});

tunnel.on("error", (error) => {
  console.error("[Localtunnel] Failed to start:", error);
  console.error("[Localtunnel] Make sure localtunnel is installed: bun add -d localtunnel");
  process.exit(1);
});

tunnel.on("exit", (code) => {
  if (code !== 0 && code !== null) {
    console.error(`[Localtunnel] Process exited with code ${code}`);
    process.exit(code);
  }
});

// Handle termination signals
process.on("SIGINT", () => {
  console.log("\n[Localtunnel] Shutting down...");
  tunnel.kill();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n[Localtunnel] Shutting down...");
  tunnel.kill();
  process.exit(0);
});

