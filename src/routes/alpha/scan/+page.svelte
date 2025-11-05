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
  <div class="container">
    <div class="loading">Checking permissions...</div>
  </div>
{:else if isAdmin}
  <div class="container">
    <div class="scan-page">
      <h1 class="page-title">QR Code Scanner</h1>
      <p class="page-description">
        Scan a user's QR code to onboard them as an explorer.
      </p>
      
      {#if errorMessage}
        <div class="error-message">{errorMessage}</div>
      {/if}
      
      <QRCodeScanner onScanned={handleScanned} onscanned={handleScanned} />
    </div>
  </div>
{:else}
  <div class="container">
    <div class="loading">Unauthorized</div>
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

  .package-selection {
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
  }

  .cup-selector {
    margin: 1.5rem 0 2rem 0;
    display: flex;
    align-items: center;
    gap: 1rem;
    justify-content: center;
  }

  .cup-selector label {
    font-weight: 600;
    color: #1a1a4e;
    font-size: 1rem;
  }

  .cup-selector select {
    padding: 0.75rem 1.5rem;
    border: 2px solid rgba(78, 205, 196, 0.3);
    border-radius: 8px;
    background: white;
    color: #1a1a4e;
    font-size: 1rem;
    cursor: pointer;
    min-width: 250px;
    transition: all 0.2s;
  }

  .cup-selector select:hover {
    border-color: #4ecdc4;
  }

  .cup-selector select:focus {
    outline: none;
    border-color: #4ecdc4;
    box-shadow: 0 0 0 3px rgba(78, 205, 196, 0.1);
  }

  .packages-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1.5rem;
    margin: 2rem 0;
  }

  .package-card {
    background: white;
    border: 2px solid rgba(78, 205, 196, 0.3);
    border-radius: 12px;
    padding: 2rem;
    cursor: pointer;
    transition: all 0.2s;
    text-align: center;
  }

  .package-card:hover:not(:disabled) {
    border-color: #4ecdc4;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(78, 205, 196, 0.2);
  }

  .package-card:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .package-name {
    color: #1a1a4e;
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0 0 0.5rem 0;
  }

  .package-weight {
    color: rgba(26, 26, 78, 0.7);
    font-size: 0.875rem;
    margin: 0.5rem 0;
  }

  .package-price {
    color: #4ecdc4;
    font-size: 1.5rem;
    font-weight: 700;
    margin: 1rem 0 0 0;
  }

  .back-button {
    background: rgba(26, 26, 78, 0.1);
    color: #1a1a4e;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    border: 2px solid rgba(26, 26, 78, 0.2);
    cursor: pointer;
    font-weight: 600;
    transition: all 0.2s;
    margin-top: 2rem;
    width: 100%;
  }

  .back-button:hover:not(:disabled) {
    background: rgba(26, 26, 78, 0.2);
  }

  .back-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .success-message {
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.3);
    color: #16a34a;
    padding: 1rem;
    border-radius: 8px;
    margin: 1rem 0;
    text-align: center;
  }

  .error-message {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #dc2626;
    padding: 1rem;
    border-radius: 8px;
    margin: 1rem 0;
    text-align: center;
  }
</style>

