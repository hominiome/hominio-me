<script lang="ts">
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { Button, Icon } from "$lib/design-system/atoms";

  interface ModalButton {
    label: string;
    onClick: () => void;
    ariaLabel?: string;
    disabled?: boolean;
    variant?: "primary" | "secondary" | "outline" | "alert";
  }

  // Receive session and signIn function from parent layout
  let {
    session,
    signInWithGoogle,
    isModalOpen = false,
    showBack = false,
    backUrl = "/alpha",
    onModalClose,
    modalLeftButtons = [],
    modalRightButtons = [],
    canCloseModal = true, // Whether the modal can be closed
    hasExplorerIdentity = true, // Whether user has explorer identity (default true for backward compatibility)
    // Voice call props
    isCallActive = false,
    isConnecting = false,
    isWaitingForPermission = false,
    onStartCall,
    onStopCall,
  } = $props<{
    session: any;
    signInWithGoogle: () => Promise<void>;
    isModalOpen?: boolean;
    showBack?: boolean;
    backUrl?: string;
    onModalClose?: () => void;
    modalLeftButtons?: ModalButton[];
    modalRightButtons?: ModalButton[];
    canCloseModal?: boolean;
    hasExplorerIdentity?: boolean;
    isCallActive?: boolean;
    isConnecting?: boolean;
    isWaitingForPermission?: boolean;
    onStartCall?: () => Promise<void>;
    onStopCall?: () => Promise<void>;
  }>();

  // Track if user image failed to load
  let userImageFailed = $state(false);
  let isAdmin = $state(false);

  // Check if user is admin reactively
  $effect(() => {
    if (session?.data?.user) {
      fetch("/alpha/api/is-admin")
        .then((res) => res.json())
        .then((data) => {
          isAdmin = data.isAdmin;
        })
        .catch((err) => {
          console.error("Failed to check admin status:", err);
          isAdmin = false;
        });
    } else {
      isAdmin = false;
    }
  });

  // Hearts balance - commented out for now
  // Can be re-enabled later by accessing Zero from context
</script>

<nav class="navbar">
  <div class="nav-container">
    <!-- Logo -->
    <a href="/alpha" class="logo-link">
      <img src="/logo.png" alt="Hominio" class="logo-image" />
      <div class="logo-content">
        <div class="logo-text">
          <span class="logo-hominio">HOMINIO</span>
          <span class="logo-cup">ALPHA</span>
        </div>
        <span class="logo-tagline">where vision becomes reality</span>
      </div>
    </a>

    <!-- Navigation Links (Desktop) -->
    <div class="nav-links desktop-nav-links">

      {#if isAdmin}
        <a
          href="/alpha/scan"
          class="nav-link"
          class:active={$page.url.pathname === "/alpha/scan"}
        >
          Scan
        </a>
      {/if}

      {#if session?.data?.user}
        <a href="/alpha/me" class="user-info-link">
          <div class="user-info">
            <span class="user-name">{session.data.user?.name || "User"}</span>
            {#if session.data.user?.image && !userImageFailed}
              <img
                src={session.data.user.image}
                alt={session.data.user.name}
                class="user-avatar"
                onerror={() => (userImageFailed = true)}
              />
            {:else if session.data.user?.name}
              <div class="user-avatar-placeholder">
                {session.data.user.name[0]?.toUpperCase() || "U"}
              </div>
            {/if}
          </div>
        </a>
      {:else}
        <button onclick={signInWithGoogle} class="btn-signin"> Sign In </button>
      {/if}
    </div>

    <!-- Back Button - Above Navbar -->
    {#if showBack}
      <div class="back-button-above-navbar">
        <Button
          variant="secondary"
          icon="mdi:arrow-left"
          iconPosition="left"
          onclick={() => {
            goto(backUrl);
          }}
          class="!rounded-full"
        >
          Back
        </Button>
      </div>
    {/if}

    <!-- Mobile Bottom Navigation -->
    {#if session?.data?.user && hasExplorerIdentity}
      <!-- Signed in: Show full navigation bar (only if user has explorer identity) -->
    <div class="mobile-bottom-nav" class:modal-mode={isModalOpen}>
      {#if isModalOpen}
        <!-- Modal Mode: Container constrained to modal max-width -->
        <div class="modal-nav-container">
          {#if modalLeftButtons.length > 0}
            <div class="modal-left-buttons">
              {#each modalLeftButtons as button}
                <Button
                  variant={button.variant || "secondary"}
                  onclick={button.onClick}
                  aria-label={button.ariaLabel || button.label}
                  disabled={button.disabled}
                  size="sm"
                    fullWidth={true}
                    class="!rounded-full {button.variant === 'primary' ? 'outline-primary-muted' : ''}"
                >
                  {button.label}
                </Button>
              {/each}
            </div>
          {/if}

          {#if canCloseModal}
            <button
              class="modal-close-button"
              onclick={() => onModalClose?.()}
              aria-label="Close"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                class="modal-close-icon"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          {/if}

          {#if modalRightButtons.length > 0}
            <div class="modal-right-buttons">
              {#each modalRightButtons as button}
                <Button
                  variant={button.variant || "primary"}
                  onclick={button.onClick}
                  aria-label={button.ariaLabel || button.label}
                  disabled={button.disabled}
                  size="sm"
                    fullWidth={true}
                  class="!rounded-full {button.variant === 'primary' ? 'outline-primary-muted' : ''}"
                >
                  {button.label}
                </Button>
              {/each}
            </div>
          {/if}
        </div>
      {:else}
        <!-- Default Mode: Always use modal-style layout with center call button -->
        <div class="footer-nav-container">
          <!-- Left-aligned items -->
          <div class="footer-nav-left">
            <a href="/alpha" class="footer-nav-link footer-nav-logo-link">
              <img src="/logo.png" alt="Hominio" class="footer-nav-logo" />
            </a>

            <!-- Vibes nav item - hidden for now, keeping as reference -->
            <a
              href="/alpha"
              class="footer-nav-link"
              class:active={$page.url.pathname === "/alpha"}
              style="display: none;"
            >
              <Icon name="mdi:check-circle" size={20} />
              <span class="footer-nav-label">Vibes</span>
            </a>
          </div>

          <!-- Center: Call Button -->
          <div class="footer-nav-center">
            {#if isCallActive}
              <Button
                variant="alert"
                onclick={() => onStopCall?.()}
                aria-label="Stop call"
                size="sm"
                class="!rounded-full aspect-square"
                disabled={isConnecting}
              >
                {#if isConnecting}
                  <svg class="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke-linecap="round"/>
                  </svg>
                {:else}
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" />
                  </svg>
                {/if}
              </Button>
            {:else}
              <Button
                variant="success"
                onclick={() => onStartCall?.()}
                aria-label={isWaitingForPermission ? "Waiting for permission" : isConnecting ? "Connecting" : "Start call"}
                size="sm"
                class="!rounded-full aspect-square"
                disabled={isConnecting || isWaitingForPermission}
              >
                {#if isConnecting || isWaitingForPermission}
                  <svg class="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke-linecap="round"/>
                  </svg>
                {:else}
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12,2A3,3 0 0,1 15,5V11A3,3 0 0,1 12,14A3,3 0 0,1 9,11V5A3,3 0 0,1 12,2M19,11C19,14.53 16.39,17.44 13,17.93V21H11V17.93C7.61,17.44 5,14.53 5,11H7A5,5 0 0,0 12,16A5,5 0 0,0 17,11H19Z" />
                  </svg>
                {/if}
              </Button>
            {/if}
          </div>

          <!-- Right-aligned items -->
          <div class="footer-nav-right">
            {#if isAdmin}
              <a
                href="/alpha/scan"
                class="footer-nav-link"
                class:active={$page.url.pathname === "/alpha/scan"}
              >
                <Icon name="mdi:qrcode-scan" size={20} />
                <span class="footer-nav-label">Scan</span>
              </a>
            {/if}

              <a href="/alpha/me" class="footer-nav-link footer-nav-user">
                {#if session.data.user?.image && !userImageFailed}
                  <img
                    src={session.data.user.image}
                    alt={session.data.user.name}
                    class="footer-user-avatar"
                    onerror={() => (userImageFailed = true)}
                  />
                {:else if session.data.user?.name}
                  <div class="footer-user-avatar-placeholder">
                    {session.data.user.name[0]?.toUpperCase() || "U"}
                  </div>
                {/if}
              </a>
            </div>
          </div>
        {/if}
      </div>
            {:else}
      <!-- Not signed in: Show only Google sign-in button directly in navbar -->
              <button
                onclick={signInWithGoogle}
        class="mobile-bottom-nav google-signin-button"
              >
        <svg class="google-icon" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        <span class="google-signin-text">Sign in with Google</span>
              </button>
            {/if}
  </div>
</nav>

<style>
  .navbar {
    position: fixed;
    top: auto;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100vw;
    z-index: 10000; /* Highest z-index - must be above everything including backdrop blur */
    margin: 0;
    padding: 0;
    border-bottom: none;
    border-top: none;
    box-shadow: none; /* Removed ugly top shadow */
    background: transparent; /* No white background around footer */
  }

  .nav-container {
    padding: 0;
    margin: 0;
    max-width: none;
    width: 100%;
    height: auto;
    flex-direction: column;
  }

  /* Logo */
  .logo-link {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    text-decoration: none;
    transition: transform 0.2s;
  }

  .logo-link:hover {
    transform: translateY(-1px);
  }

  .logo-image {
    width: 48px;
    height: 48px;
    border-radius: 50%;
  }

  .logo-content {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .logo-text {
    font-size: 1.5rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1;
    display: flex;
    gap: 0.375rem;
  }

  .logo-hominio {
    color: #1a1a4e;
  }

  .logo-cup {
    color: #f4d03f;
  }

  .logo-tagline {
    font-size: 0.75rem;
    font-weight: 500;
    color: #1a1a4e;
    letter-spacing: 0.02em;
    line-height: 1;
    text-transform: lowercase;
    font-style: italic;
  }

  /* Navigation Links */
  .nav-links {
    display: flex;
    align-items: center;
    gap: 2rem;
  }

  .nav-link {
    color: rgba(26, 26, 78, 0.7);
    font-weight: 600;
    text-decoration: none;
    transition: color 0.2s;
    position: relative;
    padding: 0.5rem 0;
  }

  .nav-link::after {
    content: "";
    position: absolute;
    bottom: 0;
    left: 0;
    width: 0;
    height: 2px;
    background: #4ecdc4;
    transition: width 0.3s;
  }

  .nav-link:hover {
    color: #4ecdc4;
  }

  .nav-link:hover::after,
  .nav-link.active::after {
    width: 100%;
  }

  .nav-link.active {
    color: #1a1a4e;
  }

  /* Hearts Badge - commented out for now */
  /* .hearts-badge {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
    border: 2px solid #fcd34d;
    border-radius: 999px;
    text-decoration: none;
    transition: all 0.2s;
  }

  .hearts-badge:hover {
    border-color: #f4d03f;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(244, 208, 63, 0.3);
  }

  .heart-icon {
    width: 1.125rem;
    height: 1.125rem;
    color: #f4d03f;
  }

  .heart-count {
    font-size: 1rem;
    font-weight: 700;
    color: #f4d03f;
    line-height: 1;
  } */

  /* User Info Link */
  .user-info-link {
    text-decoration: none;
    transition: transform 0.2s;
  }

  .user-info-link:hover {
    transform: translateY(-1px);
  }

  /* User Info */
  .user-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 1rem;
    background: rgba(78, 205, 196, 0.05);
    border-radius: 999px;
    border: 1px solid rgba(78, 205, 196, 0.2);
    transition: all 0.2s;
  }

  .user-info-link:hover .user-info {
    background: rgba(78, 205, 196, 0.1);
    border-color: rgba(78, 205, 196, 0.4);
  }

  .user-name {
    color: #1a1a4e;
    font-weight: 600;
    font-size: 0.875rem;
  }

  .user-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 2px solid #4ecdc4;
  }

  .user-avatar-placeholder {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 2px solid #4ecdc4;
    background: linear-gradient(135deg, #4ecdc4, #f4d03f);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 700;
    font-size: 0.875rem;
  }

  /* Sign In Button */
  .btn-signin {
    background: #1a1a4e;
    color: white;
    padding: 0.75rem 1.75rem;
    border-radius: 999px;
    font-weight: 600;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 0.9375rem;
  }

  .btn-signin:hover {
    background: #4ecdc4;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(78, 205, 196, 0.3);
  }

  /* Mobile Bottom Navigation - Now used on all screen sizes */
  .mobile-bottom-nav {
    display: flex;
    align-items: center;
    justify-content: center; /* Center the bar */
    width: fit-content; /* Shrink to inner content width */
    padding: 0;
    margin: 0 auto 0.375rem auto; /* 6px bottom margin, centered */
    background: var(--color-primary-500); /* Dark marine blue brand color */
    backdrop-filter: blur(12px);
    gap: 0;
    min-height: 56px; /* Thinner than before (was 60px) */
    height: 56px;
    border-radius: 9999px; /* Fully rounded 100% XL */
  }

  /* Footer nav container - defines the inner width */
  .footer-nav-container {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    width: 100%;
    padding: 0.5rem 0.75rem; /* Padding for inner content */
    padding-bottom: calc(0.5rem + env(safe-area-inset-bottom));
    gap: 0.25rem; /* Smaller gap between items */
  }

  /* Left and right sections */
  .footer-nav-left {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    justify-content: flex-start;
    min-width: 0; /* Allow flex shrinking */
  }

  .footer-nav-center {
    display: flex;
    align-items: center; /* Center vertically */
    justify-content: center;
    grid-column: 2;
    height: 100%; /* Fill container height */
  }
  
  /* Calculate nav link height for circle button */
  .footer-nav-container {
    --nav-link-content-height: 60px; /* Height of nav links including padding */
  }

  .footer-nav-right {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    justify-content: flex-end;
    min-width: 0; /* Allow flex shrinking */
  }

  /* Call button styling - ensure perfect circle, match nav link height */
  /* Ensure the Button component inside is a perfect circle */
  .footer-nav-center :global(button) {
    aspect-ratio: 1 / 1 !important; /* Force perfect circle */
    border-radius: 50% !important; /* Fully rounded */
    width: 60px !important; /* Match nav link width */
    height: 60px !important; /* Match nav link height */
    min-width: 60px !important;
    min-height: 60px !important;
    max-width: 60px !important;
    max-height: 60px !important;
    padding: 0 !important; /* Remove padding to maintain circle */
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
  }

  /* Footer nav link - refined, beautiful design */
  .footer-nav-link {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.125rem;
    padding: 0.5rem 0.75rem; /* More padding for better spacing */
    text-decoration: none;
    color: var(--color-primary-300); /* Lighter navy for inactive */
    transition: all 0.2s ease-out;
    background: transparent;
    border: none;
    cursor: pointer;
    font-family: inherit;
    border-radius: 1rem; /* More rounded - increased from 0.75rem */
    flex: 0 0 auto; /* Don't fill space */
    max-width: 60px; /* Max width constraint */
    width: 60px; /* Fixed width */
    position: relative;
    overflow: visible;
  }

  /* Subtle hover effect - same as active color */
  .footer-nav-link:hover {
    color: var(--color-secondary-300); /* Same as active - lighter teal */
    background: rgba(45, 166, 180, 0.2); /* Same as active - teal background */
  }

  /* Active state - brand secondary (teal) - lighter for better contrast */
  .footer-nav-link.active {
    color: var(--color-secondary-300); /* Lighter teal for better contrast */
    background: rgba(45, 166, 180, 0.2); /* Teal background */
  }

  .footer-nav-link.active::after {
    content: "";
    position: absolute;
    inset: -2px;
    background: rgba(45, 166, 180, 0.15);
    border-radius: 1rem; /* More rounded - increased from 0.75rem */
    z-index: -1;
    filter: blur(4px);
  }

  .footer-nav-link.active:hover {
    color: var(--color-secondary-300); /* Same as active */
    background: rgba(45, 166, 180, 0.2); /* Same as active */
  }

  /* Logo link - no active styling, maintains aspect ratio */
  .footer-nav-logo-link {
    flex: 0 0 auto; /* Don't stretch logo */
    padding: 0.5rem;
    width: auto; /* Natural width */
    max-width: none; /* No max-width constraint */
  }

  .footer-nav-logo-link:hover {
    background: rgba(8, 27, 71, 0.15); /* Subtle navy background on hover */
  }

  /* Logo styling - larger */
  .footer-nav-logo {
    width: 36px; /* Larger logo */
    height: 36px;
    border-radius: 50%;
    transition: transform 0.2s ease-out;
    display: block; /* Maintain aspect ratio */
  }

  .footer-nav-link:hover .footer-nav-logo {
    transform: scale(1.05);
  }

  /* Label styling - smaller and refined */
  .footer-nav-label {
    font-size: 0.625rem; /* Smaller font */
    font-weight: 500; /* Medium weight instead of semibold */
    letter-spacing: 0.01em;
    line-height: 1;
  }

  /* User avatar - same size and style as logo */
  .footer-user-avatar {
    width: 36px; /* Same as logo */
    height: 36px;
    border-radius: 50%;
    border: none; /* No border like logo */
    transition: transform 0.2s ease-out;
  }

  .footer-nav-link:hover .footer-user-avatar {
    transform: scale(1.05);
  }

  .footer-user-avatar-placeholder {
    width: 36px; /* Same as logo */
    height: 36px;
    border-radius: 50%;
    border: none; /* No border like logo */
    background: linear-gradient(
      135deg,
      var(--color-secondary-500),
      var(--color-accent-500)
    );
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 600;
    font-size: 1rem; /* Larger font to match logo size */
    transition: transform 0.2s ease-out;
  }

  .footer-nav-link:hover .footer-user-avatar-placeholder {
    transform: scale(1.05);
  }

  .footer-nav-user {
    flex: 0 0 auto; /* Don't fill space, same as logo */
    padding: 0.5rem; /* Same padding as logo */
    width: auto; /* Natural width */
    max-width: none; /* No max-width constraint */
  }

  /* Modal Mode Styles */
  .mobile-bottom-nav.modal-mode {
    position: relative;
    justify-content: center;
    padding: 0;
    padding-bottom: 0;
    min-height: 60px;
    height: 60px;
    backdrop-filter: none; /* No blur in modal mode */
  }

  .back-button-above-navbar {
    position: fixed;
    bottom: calc(
      56px + 0.375rem + 0.5rem
    ); /* Navbar height (56px) + margin-bottom (0.375rem) + gap (0.5rem) */
    left: 50%;
    transform: translateX(-50%);
    z-index: 10001; /* Above navbar */
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    max-width: 800px;
    padding: 0 1rem;
    pointer-events: none; /* Allow clicks to pass through container */
  }

  .back-button-above-navbar :global(button) {
    pointer-events: auto; /* Re-enable clicks on button */
  }

  /* Outline primary muted button style - matches non-active nav items */
  :global(button.outline-primary-muted) {
    background: transparent !important;
    border-color: var(--color-primary-300) !important; /* Same as non-active nav items */
    color: var(--color-primary-300) !important; /* Same as non-active nav items */
  }

  :global(button.outline-primary-muted:hover:not(:disabled)) {
    background: rgba(162, 176, 195, 0.1) !important; /* Light background on hover */
    border-color: var(--color-primary-300) !important;
    color: var(--color-primary-300) !important;
  }

  :global(button.outline-primary-muted:active:not(:disabled)) {
    background: rgba(162, 176, 195, 0.2) !important; /* Slightly darker on click */
    border-color: var(--color-primary-400) !important;
    color: var(--color-primary-400) !important;
  }

  @media (min-width: 768px) {
    .back-button-above-navbar {
      padding: 0 1.5rem;
    }
  }

  /* Container for modal mode buttons - matches modal content max-width */
  .modal-nav-container {
    width: 100%;
    max-width: 700px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    padding: 0.25rem 1rem;
    padding-bottom: calc(0.25rem + env(safe-area-inset-bottom));
    position: relative;
    min-height: 60px;
    height: 60px;
  }

  .modal-nav-container:has(.modal-close-button:not(:only-child)) {
    grid-template-columns: 1fr auto 1fr;
  }

  .modal-nav-container:not(:has(.modal-close-button)) {
    grid-template-columns: 1fr 1fr;
  }

  @media (min-width: 768px) {
    .modal-nav-container {
      max-width: 800px;
      padding: 0.25rem 1.5rem;
    }
  }

  .modal-close-button {
    grid-column: 2;
    justify-self: center;
    z-index: 2;
    background: var(--color-primary-100); /* One darker bg color */
    border: 2px solid var(--color-primary-200);
    border-radius: 50%;
    width: 2.5rem;
    height: 2.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition:
      background-color 0.2s,
      border-color 0.2s;
    flex-shrink: 0;
    margin: 0 0.75rem; /* Add margin left and right */
  }

  .modal-close-button:hover {
    background: var(--color-primary-200);
    border-color: var(--color-primary-300);
  }

  .modal-close-icon {
    width: 1rem;
    height: 1rem;
    color: var(--color-primary-600); /* Dark blue X icon */
  }

  .modal-left-buttons {
    grid-column: 1;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 0.5rem;
    z-index: 1;
    width: 100%;
  }

  .modal-right-buttons {
    grid-column: 3;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.5rem;
    z-index: 1;
    width: 100%;
  }


  /* Hide desktop nav links and logo on all screen sizes */
  .desktop-nav-links {
    display: none;
  }

  .logo-link {
    display: none; /* Hide logo - using bottom nav on all screens */
  }

  /* Google Sign-in Button Styles - directly in navbar */
  .mobile-bottom-nav.google-signin-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 0.5rem 1.5rem;
    padding-bottom: calc(0.5rem + env(safe-area-inset-bottom));
    background: var(--color-primary-500); /* Dark marine blue brand color */
    border: none;
    cursor: pointer;
    transition: all 0.2s ease-out;
    white-space: nowrap;
  }

  .mobile-bottom-nav.google-signin-button:hover {
    background: var(--color-primary-600); /* Slightly darker on hover */
    transform: translateY(-1px);
  }

  .mobile-bottom-nav.google-signin-button:active {
    transform: translateY(0);
  }

  .google-icon {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }

  .google-signin-text {
    font-size: 0.9375rem;
    font-weight: 600;
    color: white; /* White text on dark background */
  }

  /* Responsive */
  @media (max-width: 768px) {
    .footer-nav-container {
      padding: 0.375rem 0.25rem;
      padding-bottom: calc(0.375rem + env(safe-area-inset-bottom));
    }

    .footer-nav-link {
      padding: 0.375rem 0.25rem;
    }

    .footer-nav-label {
      font-size: 0.65rem;
    }

    .mobile-bottom-nav.google-signin-button {
      padding: 0.5rem 1.25rem;
      padding-bottom: calc(0.5rem + env(safe-area-inset-bottom));
      gap: 0.625rem;
    }

    .google-icon {
      width: 18px;
      height: 18px;
    }

    .google-signin-text {
      font-size: 0.875rem;
    }
  }

  @media (max-width: 480px) {
    .nav-links {
      gap: 0.5rem;
    }

    .mobile-bottom-nav.google-signin-button {
      padding: 0.5rem 1rem;
      padding-bottom: calc(0.5rem + env(safe-area-inset-bottom));
      gap: 0.5rem;
    }

    .google-icon {
      width: 16px;
      height: 16px;
    }

    .google-signin-text {
      font-size: 0.8125rem;
    }
  }
</style>
