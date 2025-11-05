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
      <p class="qr-instruction">Get Early-Adopter alpha access instead</p>
      <a
        href="https://instagram.com/samuelandert"
        target="_blank"
        rel="noopener noreferrer"
        class="instagram-button"
      >
        <svg class="instagram-icon" viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"
          />
        </svg>
        <span>Message Me For Invite</span>
      </a>
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
    margin: 0 0 1rem 0;
    font-weight: 500;
  }

  .instagram-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: linear-gradient(
      135deg,
      #f09433 0%,
      #e6683c 25%,
      #dc2743 50%,
      #cc2366 75%,
      #bc1888 100%
    );
    color: white;
    text-decoration: none;
    border-radius: 50px;
    font-size: 0.875rem;
    font-weight: 600;
    transition: all 0.3s;
    box-shadow: 0 2px 12px rgba(188, 24, 136, 0.3);
  }

  .instagram-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 20px rgba(188, 24, 136, 0.5);
  }

  .instagram-button:active {
    transform: translateY(0);
  }

  .instagram-icon {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
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

    .instagram-button {
      padding: 0.625rem 1.25rem;
      font-size: 0.813rem;
    }

    .instagram-icon {
      width: 16px;
      height: 16px;
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

