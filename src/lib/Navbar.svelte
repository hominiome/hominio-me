<script lang="ts">
  import { page } from "$app/stores";

    interface ModalButton {
      label: string;
      onClick: () => void;
      ariaLabel?: string;
      disabled?: boolean;
      variant?: "primary" | "secondary";
    }

  // Receive session and signIn function from parent layout
  let { 
    session, 
    signInWithGoogle,
    isModalOpen = false,
    onModalClose,
    modalLeftButtons = [],
    modalRightButtons = [],
  } = $props<{
    session: any;
    signInWithGoogle: () => Promise<void>;
    isModalOpen?: boolean;
    onModalClose?: () => void;
    modalLeftButtons?: ModalButton[];
    modalRightButtons?: ModalButton[];
  }>();

  // Debug - check if prop is updating
  $effect(() => {
    console.log("Navbar isModalOpen prop:", isModalOpen, "type:", typeof isModalOpen, "modalRightButtons:", modalRightButtons);
  });

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
      <a
        href="/alpha/projects"
        class="nav-link"
        class:active={$page.url.pathname === "/alpha/projects"}
      >
        Projects
      </a>

      <a
        href="/alpha/cups"
        class="nav-link"
        class:active={$page.url.pathname.startsWith("/alpha/cups")}
      >
        Cups
      </a>

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

    <!-- Mobile Bottom Navigation -->
    <div class="mobile-bottom-nav" class:modal-mode={isModalOpen}>
      {#if isModalOpen}
        <!-- Modal Mode: Container constrained to modal max-width -->
        <div class="modal-nav-container">
          {#if modalLeftButtons.length > 0}
            <div class="modal-left-buttons">
              {#each modalLeftButtons as button}
                <button
                  class="modal-action-button"
                  onclick={button.onClick}
                  aria-label={button.ariaLabel || button.label}
                >
                  {button.label}
                </button>
              {/each}
            </div>
          {/if}

          <button class="modal-close-button" onclick={() => onModalClose?.()} aria-label="Close">
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

          {#if modalRightButtons.length > 0}
            <div class="modal-right-buttons">
              {#each modalRightButtons as button}
                <button
                  class="modal-action-button"
                  class:primary={button.variant === "primary"}
                  onclick={button.onClick}
                  aria-label={button.ariaLabel || button.label}
                  disabled={button.disabled}
                >
                  {button.label}
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {:else}
        <!-- Default Mode: Normal navigation -->
      <a
        href="/alpha"
        class="mobile-nav-item mobile-nav-home"
        class:active={$page.url.pathname === "/alpha"}
      >
        <img src="/logo.png" alt="Hominio" class="mobile-nav-logo" />
      </a>

      <a
        href="/alpha"
        class="mobile-nav-item"
        class:active={$page.url.pathname === "/alpha"}
      >
        <svg
          class="mobile-nav-icon"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span class="mobile-nav-label">Live</span>
      </a>

      <a
        href="/alpha/cups"
        class="mobile-nav-item"
        class:active={$page.url.pathname.startsWith("/alpha/cups")}
      >
        <svg class="mobile-nav-icon" fill="currentColor" viewBox="0 0 24 24">
          <path
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
          />
        </svg>
        <span class="mobile-nav-label">Cups</span>
      </a>

      <a
        href="/alpha/projects"
        class="mobile-nav-item"
        class:active={$page.url.pathname === "/alpha/projects"}
      >
        <svg
          class="mobile-nav-icon"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
        <span class="mobile-nav-label">Projects</span>
      </a>

      {#if isAdmin}
        <a
          href="/alpha/scan"
          class="mobile-nav-item"
          class:active={$page.url.pathname === "/alpha/scan"}
        >
          <svg
            class="mobile-nav-icon"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
            />
          </svg>
          <span class="mobile-nav-label">Scan</span>
        </a>
      {/if}

      {#if session?.data?.user}
        <a href="/alpha/me" class="mobile-nav-item mobile-nav-user">
          {#if session.data.user?.image && !userImageFailed}
            <img
              src={session.data.user.image}
              alt={session.data.user.name}
              class="mobile-user-avatar"
              onerror={() => (userImageFailed = true)}
            />
          {:else if session.data.user?.name}
            <div class="mobile-user-avatar-placeholder">
              {session.data.user.name[0]?.toUpperCase() || "U"}
            </div>
          {/if}
        </a>
      {:else}
        <button
          onclick={signInWithGoogle}
          class="mobile-nav-item mobile-nav-signin"
        >
          <svg
            class="mobile-nav-icon"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          <span class="mobile-nav-label">Sign In</span>
        </button>
      {/if}
      {/if}
    </div>
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
    box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.2);
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
    justify-content: space-around;
    width: 100%;
    padding: 0.375rem 0.5rem;
    padding-bottom: calc(0.375rem + env(safe-area-inset-bottom));
    margin: 0;
    background: #1a1a4e; /* Dark marine blue brand color */
    backdrop-filter: blur(12px);
    gap: 0;
    min-height: 60px;
    height: 60px;
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

  /* Container for modal mode buttons - matches modal content max-width */
  .modal-nav-container {
    width: 100%;
    max-width: 600px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.25rem 0.5rem;
    padding-bottom: calc(0.25rem + env(safe-area-inset-bottom));
    position: relative;
    min-height: 60px;
    height: 60px;
  }

  /* Hide normal nav items when in modal mode */
  .mobile-bottom-nav.modal-mode .mobile-nav-item {
    display: none;
  }

  .modal-close-button {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2;
    background: rgba(255, 255, 255, 0.1);
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-radius: 50%;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
  }

  .modal-close-button:hover {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.3);
    transform: translateX(-50%) scale(1.05);
  }

  .modal-close-icon {
    width: 0.875rem;
    height: 0.875rem;
    color: rgba(255, 255, 255, 0.9);
  }

  .modal-left-buttons {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    z-index: 1;
    margin-right: auto;
  }

  .modal-right-buttons {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    z-index: 1;
    margin-left: auto;
  }

  .modal-action-button {
    background: rgba(255, 255, 255, 0.1);
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-radius: 999px;
    padding: 0.375rem 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
    font-weight: 600;
    font-size: 0.8rem;
    white-space: nowrap;
    flex-shrink: 0;
    color: rgba(255, 255, 255, 0.9);
  }

  .modal-action-button.primary {
    background: #f4d03f; /* Yellow brand color */
    border: 2px solid #f4d03f;
    color: #1a1a4e; /* Dark blue text */
    border-radius: 999px; /* Fully rounded */
  }

  .modal-action-button.primary:hover:not(:disabled) {
    background: #fcd34d; /* Lighter yellow on hover */
    border-color: #fcd34d;
    transform: scale(1.02);
  }

  .modal-action-button.primary:disabled {
    background: rgba(244, 208, 63, 0.5);
    border-color: rgba(244, 208, 63, 0.5);
    color: rgba(26, 26, 78, 0.5);
    cursor: not-allowed;
    opacity: 0.6;
  }

  .modal-action-button:hover:not(:disabled):not(.primary) {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.3);
    transform: scale(1.02);
  }

  .modal-action-button:active:not(:disabled) {
    transform: scale(1);
  }

  .modal-action-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    .modal-action-button {
      padding: 0.375rem 0.75rem;
      font-size: 0.65rem;
    }
  }

  .mobile-nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    padding: 0.5rem 1rem;
    text-decoration: none;
    color: rgba(255, 255, 255, 0.7);
    transition: all 0.2s;
    background: none;
    border: none;
    cursor: pointer;
    font-family: inherit;
  }

  .mobile-nav-item:hover {
    color: #4ecdc4;
  }

  .mobile-nav-item.active {
    color: #f4d03f; /* Yellow for active state on dark background */
  }

  .mobile-nav-icon {
    width: 24px;
    height: 24px;
  }

  .mobile-nav-label {
    font-size: 0.7rem;
    font-weight: 600;
  }

  .mobile-nav-logo {
    width: 32px;
    height: 32px;
    border-radius: 50%;
  }

  .mobile-nav-home {
    flex: 0 0 auto;
    padding: 0.25rem;
  }

  .mobile-nav-user {
    margin-left: auto;
    flex: 0 0 auto;
    padding: 0.25rem;
  }

  .mobile-user-avatar {
    width: 37px;
    height: 37px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.3);
  }

  .mobile-user-avatar-placeholder {
    width: 37px;
    height: 37px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.3);
    background: linear-gradient(135deg, #4ecdc4, #f4d03f);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 700;
    font-size: 1rem;
  }

  /* Hide desktop nav links and logo on all screen sizes */
  .desktop-nav-links {
    display: none;
  }

  .logo-link {
    display: none; /* Hide logo - using bottom nav on all screens */
  }

  /* Responsive */
  @media (max-width: 768px) {
    .logo-link {
      display: none; /* Hide logo on mobile */
    }

    .mobile-nav-item {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 0.375rem 0.25rem;
      min-width: 0;
    }

    .mobile-nav-home {
      flex: 1;
      padding: 0.375rem 0.25rem;
    }

    .mobile-nav-user {
      flex: 1;
      padding: 0.375rem 0.25rem;
    }

    .mobile-nav-signin {
      flex: 1;
      padding: 0.375rem 0.25rem;
    }

    .mobile-nav-icon {
      width: 20px;
      height: 20px;
    }

    .mobile-nav-label {
      font-size: 0.65rem;
    }
  }

  @media (max-width: 480px) {
    .nav-links {
      gap: 0.5rem;
    }
  }
</style>
