<script>
  // Available background images
  const backgroundImages = [
    '/background.jpg',
    '/hero.jpg',
    '/hominiono1.jpg',
    '/rocket.jpg',
    '/smile.jpg'
  ];

  // Randomly select a background image on component initialization
  const randomIndex = Math.floor(Math.random() * backgroundImages.length);
  const selectedImage = backgroundImages[randomIndex];
</script>

<div
  class="hello-earth-banner"
  style="background-image: url('{selectedImage}');"
>
  <div class="banner-overlay"></div>
  <div class="banner-content">
    <div class="max-w-[900px] text-center z-10">
      <div class="hello-earth-wrapper">
        <h1 class="hello-earth-title">Hello Earth</h1>
        <p class="hello-earth-subtitle">
          A new way to connect, create, and collaborate with voice-native AI experiences
          that bring us closer to our planet and each other.
        </p>
        <a href="/signin" class="cta-button">
          <span>Join the Waitlist</span>
        </a>
      </div>
    </div>
  </div>
</div>

<style>
  .hello-earth-banner {
    position: relative;
    width: 100vw;
    min-height: 100vh;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .banner-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      180deg,
      rgba(0, 0, 0, 0.3) 0%,
      rgba(0, 0, 0, 0.5) 100%
    );
    z-index: 1;
  }

  .banner-content {
    position: relative;
    z-index: 2;
    width: 100%;
    padding: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
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
    text-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  }

  .hello-earth-subtitle {
    font-size: 1.5rem;
    font-weight: 400;
    color: rgba(255, 255, 255, 0.95);
    margin: 0;
    line-height: 1.6;
    max-width: 700px;
    margin: 0 auto;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  }

  .cta-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 1rem 2rem;
    background: var(--color-primary-500);
    color: white;
    text-decoration: none;
    font-size: 1.125rem;
    font-weight: 600;
    border-radius: 50px;
    box-shadow: 0 6px 32px rgba(0, 0, 0, 0.3);
    transition: all 0.3s ease;
    margin-top: 1rem;
    border: 2px solid var(--color-primary-500);
  }

  .cta-button:hover {
    background: var(--color-accent-500);
    border-color: var(--color-primary-500);
    color: var(--color-primary-500);
    transform: translateY(-2px);
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.4);
  }

  .cta-button:active {
    transform: translateY(0);
  }

  @media (max-width: 768px) {
    .hello-earth-title {
      font-size: 3rem;
    }

    .hello-earth-subtitle {
      font-size: 1.25rem;
    }

    .cta-button {
      font-size: 1rem;
      padding: 0.875rem 1.5rem;
    }
  }

  @media (max-width: 480px) {
    .hello-earth-title {
      font-size: 2.5rem;
    }

    .hello-earth-subtitle {
      font-size: 1.125rem;
    }

    .cta-button {
      font-size: 0.938rem;
      padding: 0.75rem 1.25rem;
    }

    .banner-content {
      padding: 1.5rem;
    }
  }
</style>
