<script>
  import Hero from "$lib/components/Hero.svelte";
  import Offer from "$lib/components/Offer.svelte";
</script>

<div class="page" style="margin-top: 0 !important; padding-top: 0 !important;">
  <Hero />
  <Offer />
</div>

<!-- Fixed CTA Buttons -->
<div class="cta-fixed">
  <a href="/signin" class="cta-button cta-apply">
    <span class="cta-text-full">Signup to Waitlist</span>
    <span class="cta-text-short">Signup to Waitlist</span>
  </a>
</div>

<style>
  .page {
    min-height: 100vh;
    background: linear-gradient(180deg, #fefdfb 0%, #faf8f5 100%);
    display: block;
    padding: 0 !important;
    margin: 0 !important;
    overflow-x: hidden;
    width: 100%;
    position: relative;
    margin-top: 0 !important;
    padding-top: 0 !important;
  }

  .cta-fixed {
    position: fixed;
    bottom: 1.5rem;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    z-index: 1000;
    max-width: 600px;
    width: calc(100% - 3rem);
  }

  .cta-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    color: white;
    text-decoration: none;
    font-size: 1.125rem;
    font-weight: 600;
    padding: 1rem 1.5rem;
    border-radius: 50px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
    transition: all 0.3s;
    white-space: nowrap;
    box-sizing: border-box;
  }

  .cta-apply {
    width: auto;
    background: var(--color-primary-500);
    border: 2px solid var(--color-primary-500);
    color: var(--color-primary-100);
    box-shadow: 0 6px 32px rgba(0, 0, 0, 0.15);
  }

  .cta-apply:hover {
    background: var(--color-accent-500);
    border-color: var(--color-primary-500);
    color: var(--color-primary-500);
    transform: translateY(-2px);
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
  }

  .cta-icon {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }

  .cta-text-short {
    display: none;
  }

  .cta-text-full {
    display: inline;
  }

  @media (max-width: 768px) {
    .cta-fixed {
      bottom: 1rem;
      width: calc(100% - 2rem);
      gap: 0.5rem;
    }

    .cta-button {
      font-size: 1rem;
      padding: 0.75rem 0.875rem;
    }

    .cta-apply:hover {
      transform: translateY(-2px);
    }

    .cta-icon {
      width: 18px;
      height: 18px;
    }

    .cta-text-full {
      display: none;
    }

    .cta-text-short {
      display: inline;
    }
  }

  @media (max-width: 480px) {
    .cta-fixed {
      gap: 0.5rem;
      width: calc(100% - 2rem);
    }

    .cta-button {
      font-size: 0.938rem;
      padding: 0.75rem 0.625rem;
      gap: 0.375rem;
    }

    .cta-icon {
      width: 16px;
      height: 16px;
    }
  }
</style>
