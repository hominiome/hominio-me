<script lang="ts">
  import { Zero } from "@rocicorp/zero";
  import { nanoid } from "nanoid";
  import { schema } from "../../zero-schema";
  import { onMount, setContext } from "svelte";
  import { authClient } from "$lib/auth.client.js";
  import { browser } from "$app/environment";
  import { env as publicEnv } from "$env/dynamic/public";
  import Navbar from "$lib/Navbar.svelte";
  import ToastContainer from "$lib/ToastContainer.svelte";

  // Get session data from layout server and children snippet
  let { data, children } = $props<{
    data: any;
    children: import("svelte").Snippet;
  }>();

  const session = authClient.useSession();
  let zero: any = $state(null);
  let zeroReady = $state(false);
  let zeroError: string | null = $state(null);

  // Get Zero server URL from environment (defaults to localhost:4848 for dev)
  const zeroServerUrl = browser
    ? publicEnv.PUBLIC_ZERO_SERVER || "http://localhost:4848"
    : "http://localhost:4848";

  // Initialize Zero once and make it available via context
  onMount(() => {
    if (!browser) return; // Only run on client

    let initZero = async () => {
      try {
        // Wait for session to load (from authClient)
        while ($session.isPending) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        // Use logged-in user ID from authClient session or layout data, or 'anonymous' for public access
        const userId =
          $session.data?.user?.id || data.session?.id || `anon-${nanoid()}`;
        const hasAuth = !!($session.data?.user || data.session);

        // Initialize Zero client (works for both authenticated and anonymous users)
        zero = new Zero({
          server: zeroServerUrl,
          schema,
          userID: userId,
          // Only fetch JWT if user is logged in
          auth: hasAuth
            ? async () => {
                try {
                  const response = await fetch("/alpha/api/zero-auth");
                  if (!response.ok) return null;
                  const { token } = await response.json();
                  return token;
                } catch (error) {
                  console.error("Zero auth error:", error);
                  return null;
                }
              }
            : undefined,
        });

        zeroReady = true;
        zeroError = null;
      } catch (error) {
        console.error("Failed to initialize Zero:", error);
        zeroError = error instanceof Error ? error.message : "Unknown error";
      }
    };

    initZero();

    return () => {
      // Cleanup Zero on unmount
      if (zero) {
        // Zero doesn't have a direct destroy method, but we can close connections
        // The instance will be garbage collected when component unmounts
      }
    };
  });

  // Provide Zero instance and utilities to all child routes via context
  setContext("zero", {
    getInstance: () => zero,
    isReady: () => zeroReady,
    getError: () => zeroError,
    getServerUrl: () => zeroServerUrl,
  });

  // Sign in function - centralized here
  async function signInWithGoogle() {
    await authClient.signIn.social({
      provider: "google",
      callbackURL: "/alpha/me",
    });
  }
</script>

<Navbar session={$session} {signInWithGoogle} />

{@render children()}

<ToastContainer />
