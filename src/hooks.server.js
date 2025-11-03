import { auth } from "$lib/auth.server.js";
import { svelteKitHandler } from "better-auth/svelte-kit";
import { building } from "$app/environment";
import { startZero, stopZero } from "$lib/zero-manager.server.ts";

// Start Zero cache server ONLY in development
// In production, zero-cache runs as a separate service (hominio-me-sync)
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = !isProduction;

if (!building && isDevelopment) {
  console.log('[Zero] Starting local zero-cache-dev for development...');
  
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
} else if (!building && isProduction) {
  console.log('[Zero] Production mode: Using separate zero-cache service at sync.hominio.me');
}

export async function handle({ event, resolve }) {
  // Redirect www to non-www in production (SEO best practice)
  // Skip redirect in development (localhost)
  if (!building && isProduction) {
    const hostname = event.url.hostname;
    
    // Check if request is coming from www subdomain
    if (hostname.startsWith('www.')) {
      const baseDomain = hostname.replace(/^www\./, '');
      const url = new URL(event.url);
      url.hostname = baseDomain;
      
      // Return 301 (permanent redirect) to non-www domain
      // Preserves path and query string
      return new Response(null, {
        status: 301,
        headers: {
          'Location': url.toString(),
        },
      });
    }
  }
  
  return svelteKitHandler({ event, resolve, auth, building });
}
