import { auth } from "$lib/auth.server.js";
import { svelteKitHandler } from "better-auth/svelte-kit";
import { building } from "$app/environment";
import { startZero, stopZero } from "$lib/zero-manager.server.ts";

// Start Zero cache server when app starts (only in runtime, not during build)
if (!building) {
  // Start Zero asynchronously - don't await to avoid blocking server startup
  startZero().catch((error) => {
    console.error("[Zero] Failed to start:", error);
  });
  
  // Cleanup handlers for graceful shutdown
  process.on('SIGTERM', () => {
    console.log('📦 Received SIGTERM, shutting down gracefully...');
    stopZero();
    process.exit(0);
  });
  
  process.on('SIGINT', () => {
    console.log('📦 Received SIGINT, shutting down gracefully...');
    stopZero();
    process.exit(0);
  });
  
  process.on('exit', () => {
    stopZero();
  });
}

export async function handle({ event, resolve }) {
  return svelteKitHandler({ event, resolve, auth, building });
}
