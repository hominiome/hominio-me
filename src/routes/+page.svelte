<script>
  import Hero from "$lib/components/Hero.svelte";
  import Vision from "$lib/components/Vision.svelte";
  import HominioSummit from "$lib/components/HominioSummit.svelte";
  import CompetitionPhases from "$lib/components/CompetitionPhases.svelte";
  import HominioEvent from "$lib/components/HominioEvent.svelte";
  import HominioFounder from "$lib/components/HominioFounder.svelte";
  import JourneyVision from "$lib/components/JourneyVision.svelte";
  import FinalCTA from "$lib/components/FinalCTA.svelte";
</script>

<div class="page">
  <div class="container">
    <Hero />
    <Vision />
    <JourneyVision />

    <HominioSummit />
    <HominioEvent />
    <HominioFounder />
    <CompetitionPhases />
    <FinalCTA />

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
</div>

<!-- Fixed CTA Buttons -->
<div class="cta-fixed">
  <a
    href="https://instagram.com/HominioMe"
    target="_blank"
    rel="noopener noreferrer"
    class="cta-button cta-instagram"
  >
    <svg class="cta-icon" viewBox="0 0 24 24" fill="currentColor">
      <path
        d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"
      />
    </svg>
    <span class="cta-text-full">Follow the journey</span>
    <span class="cta-text-short">Follow</span>
  </a>

  <a
    href="https://instagram.com/samuelandert"
    target="_blank"
    rel="noopener noreferrer"
    class="cta-button cta-apply"
  >
    <span class="cta-text-full">Message Me to Apply</span>
    <span class="cta-text-short">Message Me to Apply</span>
  </a>
</div>

<style>
  .page {
    min-height: 100vh;
    background: linear-gradient(180deg, #fefdfb 0%, #faf8f5 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 3rem 1.5rem;
  }

  .container {
    max-width: 720px;
    width: 100%;
    text-align: center;
    padding-bottom: 5rem;
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
    max-width: 720px;
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

  .cta-instagram {
    flex: 0 0 auto;
    padding-left: 2rem;
    padding-right: 2rem;
    background: linear-gradient(
      135deg,
      #f09433 0%,
      #e6683c 25%,
      #dc2743 50%,
      #cc2366 75%,
      #bc1888 100%
    );
  }

  .cta-instagram:hover {
    transform: translateY(-3px);
    box-shadow: 0 6px 32px rgba(188, 24, 136, 0.5);
  }

  .cta-apply {
    flex: 1;
    background: linear-gradient(135deg, #f4d03f 0%, #f0c419 100%);
    color: #1a2847;
    box-shadow:
      inset 0 0 0 3px #1a2847,
      0 4px 24px rgba(0, 0, 0, 0.2);
  }

  .cta-apply:hover {
    transform: translateY(-3px);
    box-shadow:
      inset 0 0 0 3px #1a2847,
      0 6px 32px rgba(244, 208, 63, 0.5);
    background: linear-gradient(135deg, #f7dc5f 0%, #f3cd39 100%);
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

  .footer {
    margin-top: 3rem;
    padding-top: 2rem;
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

    .cta-instagram:hover,
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

    .page {
      padding: 2rem 1rem;
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

    .page {
      padding: 1.5rem 1rem;
    }
  }
</style>
