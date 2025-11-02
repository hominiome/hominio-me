<script lang="ts">
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import { authClient } from "$lib/auth.client.js";
  import QRCodeDisplay from "$lib/QRCodeDisplay.svelte";

  const session = authClient.useSession();

  // Get the public profile URL for QR code
  const profileUrl = $derived(
    browser && $session.data?.user?.id 
      ? `${window.location.origin}/alpha/user/${$session.data.user.id}` 
      : ""
  );

  // Redirect to home if not authenticated
  $effect(() => {
    if (!$session.isPending && !$session.data) {
      goto("/alpha");
    }
  });
</script>

<div class="container">
  <div class="invite-card">
    <div class="header">
      <h1 class="title">Invite Only</h1>
    </div>

    {#if profileUrl}
      <div class="qr-section">
        <QRCodeDisplay data={profileUrl} />
        <p class="qr-instruction">Show this QR code to Samuel or Chuck to get your voting identity</p>
      </div>
    {/if}

    <div class="info-section">
      <p class="info-text">
        This is our first alpha MVP, held together with duct tape vibes. We're invite-only right now - get set up and start voting!
      </p>
    </div>

    <div class="actions">
      <button onclick={() => goto("/alpha")} class="btn-back">
        Back to Home
      </button>
    </div>
  </div>
</div>

<style>
  .container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    background: #faf5e9;
  }

  .invite-card {
    background: white;
    border-radius: 24px;
    padding: 2rem 2rem;
    max-width: 500px;
    width: 100%;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
  }

  .header {
    text-align: center;
    width: 100%;
  }

  .title {
    font-size: 1.75rem;
    font-weight: 700;
    color: #1a1a4e;
    margin: 0 0 0.5rem 0;
  }

  .subtitle {
    font-size: 1rem;
    color: rgba(26, 26, 78, 0.7);
    margin: 0;
    font-weight: 500;
  }

  .qr-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    width: 100%;
  }

  .qr-instruction {
    font-size: 0.875rem;
    color: rgba(26, 26, 78, 0.8);
    text-align: center;
    margin: 0;
    font-weight: 500;
  }

  .info-section {
    width: 100%;
  }

  .info-text {
    font-size: 0.875rem;
    color: rgba(26, 26, 78, 0.7);
    line-height: 1.5;
    margin: 0;
    text-align: center;
  }

  .actions {
    width: 100%;
    display: flex;
    justify-content: center;
  }

  .btn-back {
    background: #1a1a4e;
    color: white;
    border: none;
    border-radius: 12px;
    padding: 0.875rem 2rem;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-back:hover {
    background: #2a2a5e;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(26, 26, 78, 0.2);
  }

  .btn-back:active {
    transform: translateY(0);
  }

  @media (max-width: 768px) {
    .container {
      padding: 1rem;
    }

    .invite-card {
      padding: 1.5rem 1.25rem;
      gap: 1.25rem;
    }

    .title {
      font-size: 1.5rem;
    }

    .subtitle {
      font-size: 0.9375rem;
    }
  }
</style>

