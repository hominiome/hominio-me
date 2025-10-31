<script lang="ts">
  import { goto } from "$app/navigation";

  // Session data from layout
  let { data } = $props();
</script>

<div class="alpha-container">
  <div class="alpha-hero">
    <h1 class="alpha-title">Hominio Alpha</h1>
    <p class="alpha-tagline">
      A first alpha test run
    </p>

    <div class="alpha-cta">
      {#if data.session}
        <button onclick={() => goto("/alpha/me")} class="btn btn-primary">
          Go to Profile
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

    <div class="alpha-projects-link">
      <a href="/alpha/projects" class="link-projects">
        View Projects →
      </a>
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

  .alpha-projects-link {
    text-align: center;
    margin-top: 2rem;
  }

  .link-projects {
    display: inline-block;
    color: #4fc3c3;
    font-size: 1.125rem;
    font-weight: 600;
    text-decoration: none;
    padding: 0.75rem 1.5rem;
    border: 2px solid #4fc3c3;
    border-radius: 12px;
    transition: all 0.2s ease;
  }

  .link-projects:hover {
    background: #4fc3c3;
    color: white;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(79, 195, 195, 0.3);
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

    .alpha-cta {
      flex-direction: column;
      width: 100%;
    }

    .btn {
      width: 100%;
    }
  }
</style>

