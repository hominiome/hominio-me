import { svelteKitHandler } from "better-auth/svelte-kit";
import { building } from "$app/environment";

let auth;

export async function handle({ event, resolve }) {
  // Skip auth entirely during build
  if (building) {
    return resolve(event);
  }

  // Lazy import auth only at runtime (not during build)
  if (!auth) {
    const authModule = await import("$lib/auth.server.js");
    auth = authModule.auth;
  }

  return svelteKitHandler({ event, resolve, auth, building });
}

