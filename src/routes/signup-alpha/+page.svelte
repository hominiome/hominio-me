<script>
  import { authClient } from "$lib/auth.client.js";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";

  let session = $state(null);
  let loading = $state(true);
  let signingIn = $state(false);

  onMount(async () => {
    // Check if user is already logged in
    const sessionData = await authClient.getSession();
    session = sessionData.data;
    loading = false;
  });

  async function signInWithGoogle() {
    signingIn = true;
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/signup-alpha",
      });
    } catch (error) {
      console.error("Sign in error:", error);
      signingIn = false;
    }
  }

  async function signOut() {
    await authClient.signOut();
    session = null;
  }
</script>

<div class="signup-container">
  <div class="signup-card">
    <div class="signup-header">
      <h1 class="signup-title">Join Hominio</h1>
      <p class="signup-subtitle">
        Be part of the 1 million co-owners building the future of purpose-driven
        startups.
      </p>
    </div>

    {#if loading}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Loading...</p>
      </div>
    {:else if session?.user}
      <div class="success-state">
        <div class="success-icon">✓</div>
        <h2 class="welcome-text">Welcome, {session.user.name}!</h2>
        <p class="email-text">{session.user.email}</p>

        <div class="user-info">
          <p class="info-text">
            You're now part of the alpha. We'll keep you updated on the Hominio
            journey.
          </p>
        </div>

        <div class="button-group">
          <button onclick={() => goto("/")} class="btn btn-primary">
            Back to Home
          </button>
          <button onclick={signOut} class="btn btn-secondary">
            Sign Out
          </button>
        </div>
      </div>
    {:else}
      <div class="signin-state">
        <button
          onclick={signInWithGoogle}
          disabled={signingIn}
          class="google-btn"
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
          us build the future of co-ownership.
        </p>
      </div>
    {/if}
  </div>
</div>

<style>
  .signup-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    background: linear-gradient(135deg, #f0fffe 0%, #fff9e6 100%);
  }

  .signup-card {
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

  .signup-header {
    text-align: center;
    margin-bottom: 2.5rem;
  }

  .signup-title {
    font-size: 2.5rem;
    font-weight: 900;
    color: #111827;
    margin: 0 0 1rem 0;
    letter-spacing: -0.02em;
  }

  .signup-subtitle {
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

  .spinner {
    width: 48px;
    height: 48px;
    border: 4px solid #e5e7eb;
    border-top-color: #4fc3c3;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Success State */
  .success-state {
    text-align: center;
  }

  .success-icon {
    width: 80px;
    height: 80px;
    background: #4fc3c3;
    color: white;
    font-size: 3rem;
    font-weight: 900;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 1.5rem;
  }

  .welcome-text {
    font-size: 1.75rem;
    font-weight: 800;
    color: #111827;
    margin: 0 0 0.5rem 0;
  }

  .email-text {
    font-size: 1rem;
    color: #6b7280;
    margin: 0 0 2rem 0;
  }

  .user-info {
    background: linear-gradient(135deg, #f0fffe 0%, white 100%);
    border-radius: 12px;
    padding: 1.5rem;
    margin-bottom: 2rem;
  }

  .info-text {
    font-size: 1rem;
    line-height: 1.6;
    color: #374151;
    margin: 0;
  }

  .button-group {
    display: flex;
    flex-direction: column;
    gap: 1rem;
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
    background: white;
    border: 2px solid #e5e7eb;
    border-radius: 12px;
    font-size: 1.063rem;
    font-weight: 600;
    color: #374151;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .google-btn:hover:not(:disabled) {
    border-color: #4fc3c3;
    box-shadow: 0 4px 16px rgba(79, 195, 195, 0.15);
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

  /* Buttons */
  .btn {
    width: 100%;
    padding: 0.875rem 1.5rem;
    border: none;
    border-radius: 12px;
    font-size: 1.063rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-primary {
    background: #4fc3c3;
    color: white;
  }

  .btn-primary:hover {
    background: #3da8a8;
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(79, 195, 195, 0.3);
  }

  .btn-secondary {
    background: white;
    color: #6b7280;
    border: 2px solid #e5e7eb;
  }

  .btn-secondary:hover {
    border-color: #d1d5db;
    background: #f9fafb;
  }

  @media (max-width: 640px) {
    .signup-container {
      padding: 1rem;
    }

    .signup-card {
      padding: 2rem 1.5rem;
    }

    .signup-title {
      font-size: 2rem;
    }

    .signup-subtitle {
      font-size: 1rem;
    }

    .welcome-text {
      font-size: 1.5rem;
    }
  }
</style>

