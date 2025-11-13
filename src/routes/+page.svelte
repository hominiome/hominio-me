<div class="page">
  <div class="coming-soon-container">
    <img src="/logo.png" alt="Hominio" class="logo" />
    <h1 class="coming-soon-text">Coming Soon</h1>
    </div>
</div>

<style>
  .page {
    min-height: 100vh;
    background: linear-gradient(180deg, #fefdfb 0%, #faf8f5 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    margin: 0;
    overflow-x: hidden;
    width: 100%;
    position: relative;
  }

  .coming-soon-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2rem;
    text-align: center;
  }

  .logo {
    width: 120px;
    height: auto;
    margin-bottom: 1rem;
    }

  .coming-soon-text {
    font-size: 2.5rem; /* 40px */
    font-weight: 500;
    color: var(--color-brand-navy-500);
    margin: 0;
    line-height: 1.3;
    letter-spacing: 0.5px;
  }

  @media (min-width: 768px) {
    .coming-soon-text {
      font-size: 3.5rem; /* 56px - md:text-5xl */
    }

    .logo {
      width: 150px;
    }
  }

  @media (min-width: 1024px) {
    .coming-soon-text {
      font-size: 4.5rem; /* 72px - lg:text-6xl */
    }

    .logo {
      width: 180px;
    }
  }
</style>
