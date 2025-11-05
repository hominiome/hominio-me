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

  // Get the invite link for admin onboarding
  const inviteLink = $derived(
    browser && $session.data?.user?.id 
      ? `${window.location.origin}/alpha/invite/${$session.data.user.id}` 
      : ""
  );

  let copied = $state(false);

  async function copyToClipboard() {
    if (!inviteLink) return;
    
    try {
      await navigator.clipboard.writeText(inviteLink);
      copied = true;
      setTimeout(() => {
        copied = false;
      }, 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  }
</script>

<div class="invite-content">
  <div class="header">
    <h1 class="title">Invite Only</h1>
  </div>

  {#if profileUrl}
    <div class="qr-section">
      <QRCodeDisplay data={profileUrl} />
      <p class="qr-instruction">Show this QR code to Samuel or Chuck to get your explorer identity</p>
    </div>
  {/if}

  {#if inviteLink}
    <div class="link-section">
      <p class="link-label">Or share this link:</p>
      <div class="link-container">
        <input 
          type="text" 
          value={inviteLink} 
          readonly 
          class="link-input"
          onclick={(e) => e.currentTarget.select()}
        />
        <button 
          onclick={copyToClipboard}
          class="copy-button"
          aria-label="Copy link to clipboard"
        >
          {copied ? "Copied!" : "Copy Link"}
        </button>
      </div>
    </div>
  {/if}

  <div class="info-section">
    <p class="info-text">
      This is our first alpha MVP, held together with duct tape vibes. We're invite-only right now - get onboarded as an explorer to access the platform!
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

  .link-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    max-width: 500px;
  }

  .link-label {
    font-size: 0.875rem;
    color: rgba(26, 26, 78, 0.8);
    text-align: center;
    margin: 0;
    font-weight: 500;
  }

  .link-container {
    display: flex;
    gap: 0.5rem;
    width: 100%;
    align-items: center;
  }

  .link-input {
    flex: 1;
    padding: 0.625rem 0.875rem;
    border: 2px solid rgba(78, 205, 196, 0.3);
    border-radius: 8px;
    background: white;
    color: #1a1a4e;
    font-size: 0.875rem;
    font-family: monospace;
    cursor: text;
  }

  .link-input:focus {
    outline: none;
    border-color: #4ecdc4;
    box-shadow: 0 0 0 3px rgba(78, 205, 196, 0.1);
  }

  .copy-button {
    padding: 0.625rem 1.25rem;
    background: #4ecdc4;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .copy-button:hover {
    background: #3db5ac;
    transform: translateY(-1px);
  }

  .copy-button:active {
    transform: translateY(0);
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

    .link-container {
      flex-direction: column;
    }

    .link-input {
      width: 100%;
    }

    .copy-button {
      width: 100%;
    }
  }
</style>

