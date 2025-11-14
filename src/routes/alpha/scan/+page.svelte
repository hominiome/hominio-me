<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { authClient } from "$lib/auth.client.js";
  import QRCodeScanner from "$lib/QRCodeScanner.svelte";

  const session = authClient.useSession();
  let isAdmin = $state(false);
  let checkingAdmin = $state(true);
  let errorMessage = $state("");

  onMount(async () => {
    // Wait for session to load
    while ($session.isPending) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (!$session.data?.user) {
      goto("/alpha");
      return;
    }

    // Check if user is admin
    try {
      const response = await fetch("/alpha/api/is-admin");
      if (response.ok) {
        const data = await response.json();
        isAdmin = data.isAdmin;
        checkingAdmin = false;

        if (!isAdmin) {
          goto("/alpha");
          return;
        }
      } else {
        goto("/alpha");
        return;
      }
    } catch (error) {
      console.error("Failed to check admin status:", error);
      goto("/alpha");
      return;
    }

  });

  async function handleScanned(userIdOrEvent: string | CustomEvent<{ userId: string }>) {
    let userId: string;
    
    // Handle both callback (string) and event (CustomEvent) formats
    if (typeof userIdOrEvent === "string") {
      userId = userIdOrEvent;
    } else {
      userId = userIdOrEvent.detail.userId;
    }
    
    if (!userId) {
      console.error("❌ No userId found");
      errorMessage = "Invalid QR code - no user ID found";
      return;
    }

    // Redirect to invite route for onboarding
    goto(`/alpha/invite/${userId}`);
  }

</script>

{#if checkingAdmin}
  <div class="max-w-3xl mx-auto px-4 py-16 min-h-[60vh] flex items-center justify-center">
    <div class="text-center text-brand-navy-800 text-lg">Checking permissions...</div>
  </div>
{:else if isAdmin}
  <div class="max-w-3xl mx-auto px-4 py-16 min-h-[60vh] flex items-center justify-center">
    <div class="w-full text-center">
      <h1 class="text-brand-navy-800 text-3xl font-bold mb-4">QR Code Scanner</h1>
      <p class="text-brand-navy-600 text-base mb-8">
        Scan a user's QR code to onboard them as an explorer.
      </p>
      
      {#if errorMessage}
        <div class="bg-red-100 border border-red-300 text-red-700 px-4 py-4 rounded-lg my-4 text-center">{errorMessage}</div>
      {/if}
      
      <QRCodeScanner onScanned={handleScanned} onscanned={handleScanned} />
    </div>
  </div>
{:else}
  <div class="max-w-3xl mx-auto px-4 py-16 min-h-[60vh] flex items-center justify-center">
    <div class="text-center text-brand-navy-800 text-lg">Unauthorized</div>
  </div>
{/if}

