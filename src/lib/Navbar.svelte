<script lang="ts">
  import { page } from "$app/stores";

  // Receive session and signIn function from parent layout
  let { session, signInWithGoogle } = $props<{
    session: any;
    signInWithGoogle: () => Promise<void>;
  }>();

  // Track if user image failed to load
  let userImageFailed = $state(false);

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
    <div class="mobile-bottom-nav">
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
        <svg
          class="mobile-nav-icon"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
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
    </div>
  </div>
</nav>

<style>
  .navbar {
    position: sticky;
    top: 0;
    bottom: auto;
    left: 0;
    right: 0;
    width: 100%;
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

  /* Mobile Bottom Navigation */
  .mobile-bottom-nav {
    display: none;
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

  /* Responsive */
  @media (max-width: 768px) {
    .navbar {
      position: fixed;
      top: auto;
      bottom: 0;
      left: 0;
      right: 0;
      width: 100vw;
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

    .logo-link {
      display: none; /* Hide logo on mobile */
    }

    .desktop-nav-links {
      display: none; /* Hide desktop nav on mobile */
    }

    .mobile-bottom-nav {
      display: flex;
      align-items: center;
      justify-content: space-around;
      width: 100%;
      padding: 0.375rem 0.5rem;
      margin: 0;
      background: #1a1a4e; /* Dark marine blue brand color */
      backdrop-filter: blur(12px);
      gap: 0;
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
