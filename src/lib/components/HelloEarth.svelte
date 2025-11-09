<script>
  // Array of available background images
  const backgroundImages = [
    '/background.jpg',
    '/hero.jpg',
    '/hominiono1.jpg',
    '/rocket.jpg',
    '/smile.jpg',
    '/1milliontower.png'
  ];

  // Select a random background image
  const randomBackground = backgroundImages[Math.floor(Math.random() * backgroundImages.length)];
</script>

<div
  class="flex items-center justify-center p-8 sm:p-12 relative min-h-screen hero-banner"
  style="background-image: url('{randomBackground}');"
>
  <!-- Overlay for better text readability -->
  <div class="hero-overlay"></div>
  
  <div class="max-w-[900px] text-center z-10">
    <style>
      .hero-banner {
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
        position: relative;
      }

      .hero-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(
          135deg,
          rgba(8, 27, 71, 0.4) 0%,
          rgba(8, 27, 71, 0.6) 100%
        );
        z-index: 1;
      }

      .hello-earth-wrapper {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1.5rem;
        margin-bottom: 2rem;
      }

      .hello-earth-title {
        font-size: 4rem;
        font-weight: 700;
        color: white;
        margin: 0;
        line-height: 1.1;
        font-family: var(--font-family-title);
        text-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      }

      .hello-earth-subtitle {
        font-size: 1.5rem;
        font-weight: 400;
        color: rgba(255, 255, 255, 0.95);
        margin: 0;
        line-height: 1.6;
        max-width: 700px;
        margin: 0 auto;
        text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      }

      .action-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        background: var(--color-primary-500);
        color: white;
        text-decoration: none;
        font-size: 1.25rem;
        font-weight: 600;
        padding: 1rem 2rem;
        border-radius: 50px;
        margin-top: 2rem;
        box-shadow: 0 6px 32px rgba(0, 0, 0, 0.3);
        transition: all 0.3s ease;
        border: 2px solid var(--color-primary-500);
      }

      .action-button:hover {
        background: var(--color-accent-500);
        border-color: var(--color-primary-500);
        color: var(--color-primary-500);
        transform: translateY(-2px);
        box-shadow: 0 8px 40px rgba(0, 0, 0, 0.4);
      }

      @media (max-width: 768px) {
        .hello-earth-title {
          font-size: 3rem;
        }

        .hello-earth-subtitle {
          font-size: 1.25rem;
        }

        .action-button {
          font-size: 1.125rem;
          padding: 0.875rem 1.75rem;
        }
      }

      @media (max-width: 480px) {
        .hello-earth-title {
          font-size: 2.5rem;
        }

        .hello-earth-subtitle {
          font-size: 1.125rem;
        }

        .action-button {
          font-size: 1rem;
          padding: 0.75rem 1.5rem;
        }
      }
    </style>
    
    <div class="hello-earth-wrapper">
      <h1 class="hello-earth-title">Hello Earth</h1>
      <p class="hello-earth-subtitle">
        A new way to connect, create, and collaborate with voice-native AI experiences
        that bring us closer to our planet and each other.
      </p>
      <a href="/signin" class="action-button">
        Get Started
      </a>
    </div>
  </div>
</div>
