<script>
  import { goto } from "$app/navigation";

  // Session data from layout
  let { data } = $props();
</script>

<div class="alpha-container">
  <div class="alpha-hero">
    <h1 class="alpha-title">Hominio Alpha</h1>
    <p class="alpha-tagline">
      Be one of the first 1 million co-owners building the future of
      purpose-driven startups.
    </p>

    <div class="alpha-stats">
      <div class="stat-item">
        <span class="stat-number">1M</span>
        <span class="stat-label">Co-Owners</span>
      </div>
      <div class="stat-divider">×</div>
      <div class="stat-item">
        <span class="stat-number">€1</span>
        <span class="stat-label">Each</span>
      </div>
      <div class="stat-divider">=</div>
      <div class="stat-item">
        <span class="stat-number">€1M</span>
        <span class="stat-label">For Startups</span>
      </div>
    </div>

    <div class="alpha-cta">
      {#if data.session}
        <button onclick={() => goto("/alpha/me")} class="btn btn-primary">
          Go to Profile
        </button>
        <button onclick={() => goto("/")} class="btn btn-secondary">
          Back to Home
        </button>
      {:else}
        <button onclick={() => goto("/alpha/signup")} class="btn btn-primary">
          Join Alpha
        </button>
        <button onclick={() => goto("/alpha/signup")} class="btn btn-secondary">
          Login
        </button>
      {/if}
    </div>

    {#if !data.session}
      <p class="alpha-link">
        <a href="/" class="link">Learn more about Hominio →</a>
      </p>
    {/if}

    <div class="alpha-features">
      <div class="feature">
        <span class="feature-icon">🚀</span>
        <span class="feature-text">Early Access</span>
      </div>
      <div class="feature">
        <span class="feature-icon">🗳️</span>
        <span class="feature-text">Vote on Decisions</span>
      </div>
      <div class="feature">
        <span class="feature-icon">💰</span>
        <span class="feature-text">Co-Ownership</span>
      </div>
    </div>
  </div>
</div>

<style>
  .alpha-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    background: linear-gradient(135deg, #f0fffe 0%, #fff9e6 100%);
  }

  .alpha-hero {
    width: 100%;
    max-width: 600px;
    text-align: center;
  }

  .alpha-title {
    font-size: 3.5rem;
    font-weight: 900;
    color: #111827;
    margin: 0 0 1rem 0;
    letter-spacing: -0.03em;
    background: linear-gradient(135deg, #4fc3c3 0%, #f4d03f 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .alpha-tagline {
    font-size: 1.25rem;
    line-height: 1.6;
    color: #6b7280;
    margin: 0 0 3rem 0;
    max-width: 500px;
    margin-left: auto;
    margin-right: auto;
  }

  .alpha-stats {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 1.5rem;
    margin-bottom: 3rem;
    padding: 2rem;
    background: white;
    border-radius: 16px;
    border: 2px solid #4fc3c3;
    box-shadow: 0 4px 16px rgba(79, 195, 195, 0.15);
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .stat-number {
    font-size: 2rem;
    font-weight: 900;
    color: #4fc3c3;
    line-height: 1;
  }

  .stat-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .stat-divider {
    font-size: 2rem;
    font-weight: 700;
    color: #f4d03f;
  }

  .alpha-cta {
    display: flex;
    gap: 1rem;
    justify-content: center;
    margin-bottom: 1.5rem;
  }

  .alpha-link {
    text-align: center;
    margin: 0 0 3rem 0;
  }

  .link {
    color: #6b7280;
    text-decoration: none;
    font-size: 0.938rem;
    font-weight: 500;
    transition: color 0.2s ease;
  }

  .link:hover {
    color: #4fc3c3;
  }

  .btn {
    padding: 0.875rem 2rem;
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
    border-color: #4fc3c3;
    color: #4fc3c3;
  }

  .alpha-features {
    display: flex;
    justify-content: center;
    gap: 2rem;
    padding: 1.5rem;
    background: white;
    border-radius: 12px;
    border: 1px solid #e5e7eb;
  }

  .feature {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .feature-icon {
    font-size: 2rem;
  }

  .feature-text {
    font-size: 0.875rem;
    font-weight: 600;
    color: #6b7280;
  }

  @media (max-width: 640px) {
    .alpha-container {
      padding: 1.5rem;
    }

    .alpha-title {
      font-size: 2.5rem;
    }

    .alpha-tagline {
      font-size: 1.063rem;
      margin-bottom: 2rem;
    }

    .alpha-stats {
      flex-direction: column;
      gap: 0.75rem;
      padding: 1.5rem;
    }

    .stat-number {
      font-size: 1.5rem;
    }

    .stat-divider {
      transform: rotate(90deg);
      font-size: 1.5rem;
    }

    .alpha-cta {
      flex-direction: column;
      width: 100%;
    }

    .btn {
      width: 100%;
    }

    .alpha-features {
      flex-direction: column;
      gap: 1rem;
    }
  }
</style>

