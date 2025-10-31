<script lang="ts">
  import { Zero } from "@rocicorp/zero";
  import { nanoid } from "nanoid";
  import { schema } from "../../zero-schema";
  import { onMount, setContext } from "svelte";
  import { authClient } from "$lib/auth.client.js";

  // Get session data from layout server
  let { data } = $props();

  const session = authClient.useSession();
  let zero: any = $state(null);
  let zeroReady = $state(false);

  // Initialize Zero once and make it available via context
  onMount(() => {
    let initZero = async () => {
      // Wait for session to load (from authClient)
      while ($session.isPending) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Use logged-in user ID from authClient session or layout data, or 'anonymous' for public access
      const userId = $session.data?.user?.id || data.session?.id || `anon-${nanoid()}`;
      const hasAuth = !!($session.data?.user || data.session);

      // Initialize Zero client (works for both authenticated and anonymous users)
      zero = new Zero({
        server: "http://localhost:4848",
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

  // Provide Zero instance to all child routes via context
  setContext("zero", {
    getInstance: () => zero,
    isReady: () => zeroReady,
  });
</script>

<slot />

