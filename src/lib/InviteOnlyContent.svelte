<script lang="ts">
  import { browser } from "$app/environment";
  import { authClient } from "$lib/auth.client.js";
  import QRCodeDisplay from "$lib/QRCodeDisplay.svelte";

  const session = authClient.useSession();

  // Get the public profile URL for QR code
  const profileUrl = $derived(
    browser && $session.data?.user?.id 
      ? `${window.location.origin}/alpha/user/${$session.data.user.id}` 
      : ""
  );
</script>

<div class="invite-content">
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
</div>

<style>
  .invite-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    width: 100%;
    padding: 1rem 0;
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

  @media (max-width: 768px) {
    .invite-content {
      gap: 1.25rem;
      padding: 0.5rem 0;
    }

    .title {
      font-size: 1.5rem;
    }
  }
</style>

