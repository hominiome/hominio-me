<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { authClient } from "$lib/auth.client.js";
  import QRCodeScanner from "$lib/QRCodeScanner.svelte";

  const session = authClient.useSession();
  let isAdmin = $state(false);
  let checkingAdmin = $state(true);

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
</script>

{#if checkingAdmin}
  <div class="container">
    <div class="loading">Checking permissions...</div>
  </div>
{:else if isAdmin}
  <div class="container">
    <div class="scan-page">
      <h1 class="page-title">QR Code Scanner</h1>
      <p class="page-description">
        Scan a QR code to navigate to a user profile or other page.
      </p>
      <QRCodeScanner />
    </div>
  </div>
{/if}

<style>
  .container {
    max-width: 800px;
    margin: 0 auto;
    padding: 4rem 1rem;
    min-height: 60vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .loading {
    text-align: center;
    color: #1a1a4e;
    font-size: 1.125rem;
  }

  .scan-page {
    width: 100%;
    text-align: center;
  }

  .page-title {
    color: #1a1a4e;
    font-size: 2rem;
    font-weight: 700;
    margin: 0 0 1rem 0;
  }

  .page-description {
    color: rgba(26, 26, 78, 0.7);
    font-size: 1rem;
    margin: 0 0 2rem 0;
  }
</style>

