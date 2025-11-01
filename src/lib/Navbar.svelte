<script lang="ts">
  import { page } from "$app/stores";

  // Receive session and signIn function from parent layout
  let { session, signInWithGoogle } = $props<{
    session: any;
    signInWithGoogle: () => Promise<void>;
  }>();

  // Mobile menu state
  let mobileMenuOpen = $state(false);
  // Track if user image failed to load
  let userImageFailed = $state(false);

  function toggleMobileMenu() {
    mobileMenuOpen = !mobileMenuOpen;
  }

  function closeMobileMenu() {
    mobileMenuOpen = false;
  }

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

    <!-- Navigation Links -->
    <div class="nav-links">
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

      {#if session?.data?.user}
        <!-- Heart Balance - commented out for now -->
        <!-- Can access Zero from context if needed later -->
        <!-- <a href="/alpha/purchase" class="hearts-badge">
          <svg class="heart-icon" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
            />
          </svg>
          <span class="heart-count">{heartBalance}</span>
        </a> -->

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

    <!-- Mobile Menu Button -->
    <button
      class="mobile-menu-btn"
      onclick={toggleMobileMenu}
      aria-label="Toggle menu"
    >
      {#if mobileMenuOpen}
        <svg
          class="mobile-menu-icon"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      {:else}
        <svg
          class="mobile-menu-icon"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      {/if}
    </button>
  </div>

  <!-- Mobile Menu -->
  {#if mobileMenuOpen}
    <div class="mobile-menu">
      <a
        href="/alpha/projects"
        class="mobile-nav-link"
        class:active={$page.url.pathname === "/alpha/projects"}
        onclick={closeMobileMenu}
      >
        Projects
      </a>
      <a
        href="/alpha/cups"
        class="mobile-nav-link"
        class:active={$page.url.pathname.startsWith("/alpha/cups")}
        onclick={closeMobileMenu}
      >
        Cups
      </a>
    </div>
  {/if}
</nav>

<style>
  .navbar {
    position: sticky;
    top: 0;
    z-index: 1000;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(26, 26, 78, 0.08);
    box-shadow: 0 2px 12px rgba(26, 26, 78, 0.04);
  }

  .nav-container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 80px;
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

  /* Mobile Menu Button */
  .mobile-menu-btn {
    display: none;
    background: none;
    border: none;
    cursor: pointer;
    color: #1a1a4e;
    padding: 0.5rem;
    transition: all 0.2s;
  }

  .mobile-menu-btn:hover {
    color: #4ecdc4;
  }

  .mobile-menu-icon {
    width: 24px;
    height: 24px;
  }

  /* Mobile Menu */
  .mobile-menu {
    display: none;
    flex-direction: column;
    background: white;
    border-top: 1px solid rgba(26, 26, 78, 0.08);
    padding: 1rem;
    gap: 0.5rem;
  }

  .mobile-nav-link {
    display: block;
    padding: 0.75rem 1rem;
    color: rgba(26, 26, 78, 0.7);
    font-weight: 600;
    text-decoration: none;
    border-radius: 8px;
    transition: all 0.2s;
  }

  .mobile-nav-link:hover {
    background: rgba(78, 205, 196, 0.1);
    color: #4ecdc4;
  }

  .mobile-nav-link.active {
    background: rgba(78, 205, 196, 0.15);
    color: #1a1a4e;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .nav-container {
      padding: 0 1rem;
      height: 70px;
    }

    .logo-content {
      display: none;
    }

    .logo-image {
      width: 40px;
      height: 40px;
    }

    .nav-links {
      gap: 1rem;
    }

    .nav-link {
      display: none;
    }

    /* Keep user info visible on mobile, but compact */
    .user-info-link {
      display: block;
    }

    .user-name {
      display: none; /* Hide name on mobile, just show avatar */
    }

    .user-info {
      padding: 0.375rem 0.5rem; /* Smaller padding on mobile */
    }

    .btn-signin {
      display: block; /* Keep sign in button visible */
      padding: 0.5rem 1rem;
      font-size: 0.875rem;
    }

    .mobile-menu-btn {
      display: block;
    }

    .mobile-menu {
      display: flex;
    }
  }

  @media (max-width: 480px) {
    .nav-links {
      gap: 0.5rem;
    }
  }
</style>
