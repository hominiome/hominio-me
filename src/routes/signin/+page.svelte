<script>
  import { authClient } from "$lib/auth.client.js";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import Loading from "$lib/components/Loading.svelte";

  let loading = $state(true);
  let signingIn = $state(false);

  onMount(async () => {
    // Check if user is already logged in and redirect to profile
    const sessionData = await authClient.getSession();
    if (sessionData?.data?.user) {
      goto("/alpha/me");
      return;
    }
    loading = false;
  });

  async function signInWithGoogle() {
    signingIn = true;
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/alpha/me", // Redirect to profile page after signup/login
      });
    } catch (error) {
      console.error("Sign in error:", error);
      signingIn = false;
    }
  }
</script>

<div class="signin-container">
  <div class="signin-card">
    <div class="signin-header">
      <h1 class="signin-title">Sign In to Hominio</h1>
      <p class="signin-subtitle">
        Join the alpha and help us build the future of purpose-driven startups.
      </p>
    </div>

    {#if loading}
      <div class="loading-state">
        <Loading />
      </div>
    {:else}
      <div class="signin-state">
        <button
          onclick={signInWithGoogle}
          disabled={signingIn}
          class="google-btn rounded-full"
        >
          {#if signingIn}
            <div class="btn-spinner"></div>
            <span>Signing in...</span>
          {:else}
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
            <span>Continue with Google</span>
          {/if}
        </button>

        <div class="divider">
          <span>Alpha Access Only</span>
        </div>

        <p class="terms-text">
          By continuing, you agree to participate in the Hominio Alpha and help
          us build the future of co-ownership. You also agree to our{" "}
          <a href="/privacy-policy" class="terms-link">Privacy Policy</a>.
        </p>
      </div>
    {/if}
  </div>

  <!-- Footer -->
  <div class="footer">
    <a href="/legal-notice" class="footer-link">Site Notice</a>
    <span class="footer-separator">·</span>
    <a href="/privacy-policy" class="footer-link">Privacy Policy</a>
    <span class="footer-separator">·</span>
    <a href="/social-media-privacy-policy" class="footer-link"
      >Social Media Policy</a
    >
  </div>
</div>

<style>
  .signin-container {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    background: linear-gradient(135deg, #f0fffe 0%, #fff9e6 100%);
    position: relative;
  }

  .signin-card {
    width: 100%;
    max-width: 480px;
    background: white;
    border-radius: 24px;
    box-shadow:
      0 8px 32px rgba(79, 195, 195, 0.15),
      0 2px 8px rgba(0, 0, 0, 0.05);
    padding: 3rem;
    border: 2px solid #4fc3c3;
  }

  .signin-header {
    text-align: center;
    margin-bottom: 2.5rem;
  }

  .signin-title {
    font-size: 2.5rem;
    font-weight: 900;
    color: #111827;
    margin: 0 0 1rem 0;
    letter-spacing: -0.02em;
  }

  .signin-subtitle {
    font-size: 1.125rem;
    line-height: 1.6;
    color: #6b7280;
    margin: 0;
  }

  /* Loading State */
  .loading-state {
    text-align: center;
    padding: 3rem 0;
  }

  /* Sign In State */
  .signin-state {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .google-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    width: 100%;
    padding: 1rem 1.5rem;
    background: var(--color-primary-500);
    border: 2px solid var(--color-primary-500);
    border-radius: 9999px;
    font-size: 1.063rem;
    font-weight: 600;
    color: var(--color-primary-100);
    cursor: pointer;
    transition: all 0.2s ease;
    backdrop-filter: blur(4px);
  }

  .google-btn:hover:not(:disabled) {
    background: transparent;
    border-color: var(--color-primary-500);
    color: var(--color-primary-500);
    transform: translateY(-2px);
  }

  .google-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .google-icon {
    width: 24px;
    height: 24px;
    flex-shrink: 0;
  }

  .btn-spinner {
    width: 20px;
    height: 20px;
    border: 3px solid #e5e7eb;
    border-top-color: #4fc3c3;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .divider {
    position: relative;
    text-align: center;
    margin: 1rem 0;
  }

  .divider::before,
  .divider::after {
    content: "";
    position: absolute;
    top: 50%;
    width: calc(50% - 80px);
    height: 1px;
    background: #e5e7eb;
  }

  .divider::before {
    left: 0;
  }

  .divider::after {
    right: 0;
  }

  .divider span {
    display: inline-block;
    padding: 0 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    background: white;
  }

  .terms-text {
    font-size: 0.875rem;
    line-height: 1.5;
    color: #9ca3af;
    text-align: center;
    margin: 0;
  }

  .terms-link {
    color: #4fc3c3;
    text-decoration: underline;
    transition: color 0.2s ease;
  }

  .terms-link:hover {
    color: #3db5ac;
  }

  .footer {
    position: absolute;
    bottom: 2rem;
    left: 50%;
    transform: translateX(-50%);
    width: 100%;
    max-width: 100%;
    margin-top: 2rem;
    padding-top: 1.5rem;
    padding-bottom: 0;
    border-top: 1px solid #e5e7eb;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .footer-link {
    font-size: 0.875rem;
    color: #6b7280;
    text-decoration: none;
    transition: color 0.2s;
  }

  .footer-link:hover {
    color: #111827;
  }

  .footer-separator {
    color: #d1d5db;
    font-size: 0.875rem;
  }

  @media (max-width: 640px) {
    .signin-container {
      padding: 1rem;
    }

    .signin-card {
      padding: 2rem 1.5rem;
    }

    .signin-title {
      font-size: 2rem;
    }

    .signin-subtitle {
      font-size: 1rem;
    }
  }
</style>

