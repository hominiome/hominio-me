<script>
</script>

<div class="hero-container">
  <div class="hero-content">
    <img src="/logo.png" alt="Vibes Logo" class="hero-logo" />
    <h1 class="hero-title">
      Apps are oldschool
    </h1>
    <div class="hero-vibes-section">
      <p class="hero-description">
        Introducing Vibes - voice-native AI apps - that are the future of how we interact with AI.
      </p>
    </div>
    <p class="hero-subdescription">
      For entrepreneurs, solo founders, and SMBs. We build custom voice-native Vibes that let users interact with your offers through conversational AI.
    </p>
  </div>
</div>

<style>
  .hero-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(180deg, #fefdfb 0%, #faf8f5 100%);
    padding: 2rem 1.5rem;
    position: relative;
  }

  .hero-content {
    max-width: 800px;
    text-align: center;
    z-index: 1;
  }

  .hero-logo {
    width: 80px;
    height: auto;
    margin: 0 auto 2rem auto;
    display: block;
  }

  .hero-title {
    font-size: 3rem;
    font-weight: 800;
    color: var(--color-primary-500);
    margin: 0 0 2rem 0;
    letter-spacing: -0.02em;
    line-height: 1.1;
  }

  .hero-vibes-section {
    color: var(--color-secondary-500);
    margin: 0 0 1.5rem 0;
    max-width: 700px;
    margin-left: auto;
    margin-right: auto;
  }

  .hero-description {
    font-size: 1.5rem;
    line-height: 1.7;
    color: var(--color-secondary-500);
    margin: 0;
    font-weight: 700;
  }

  .hero-subdescription {
    font-size: 1.125rem;
    line-height: 1.6;
    color: var(--color-primary-600);
    margin: 0;
    max-width: 650px;
    margin-left: auto;
    margin-right: auto;
  }


  @media (min-width: 640px) {
    .hero-container {
      padding: 3rem 2rem;
    }

    .hero-title {
      font-size: 3.5rem;
    }

    .hero-description {
      font-size: 1.75rem;
    }

    .hero-subdescription {
      font-size: 1.25rem;
    }

    .hero-logo {
      width: 100px;
      margin-bottom: 2.5rem;
    }
  }

  @media (min-width: 1024px) {
    .hero-title {
      font-size: 4rem;
    }

    .hero-description {
      font-size: 2rem;
    }

    .hero-subdescription {
      font-size: 1.375rem;
    }

    .hero-logo {
      width: 120px;
      margin-bottom: 3rem;
    }
  }

  @media (max-width: 480px) {
    .hero-title {
      font-size: 2.5rem;
    }

    .hero-description {
      font-size: 1.375rem;
    }

    .hero-subdescription {
      font-size: 1rem;
    }

    .hero-logo {
      width: 70px;
      margin-bottom: 1.5rem;
    }
  }
</style>
