<script>
</script>

<div class="journey-container">
  <div class="journey-wrapper">
    <div class="journey-hero">
      <p class="journey-highlight">During the next year,</p>
      <h2 class="journey-main">
        <span class="highlight-number">1 million</span> humans will unite
      </h2>
      <h2 class="journey-main">
        to turn <span class="highlight-years">€1 each</span>
      </h2>
      <p class="journey-closing">
        into a new breed of purpose-driven startups<br />
        that reshape our future.
      </p>
    </div>
    <div class="numbers-compact">
      <div class="equation-top">
        <span class="stat-item"><strong>1M</strong> Humans</span>
        <span class="stat-divider">×</span>
        <span class="stat-item"><strong>€1</strong> Each</span>
      </div>
      <span class="stat-divider equals-sign">=</span>
      <span class="stat-item highlight result"
        ><strong>€1M</strong> for the Founder</span
      >
    </div>
  </div>
</div>

<style>
  .journey-container {
    max-width: 800px;
    margin: 4rem auto;
  }

  .journey-wrapper {
    margin-bottom: 3rem;
  }

  .journey-hero {
    text-align: center;
    margin-bottom: 3rem;
    padding: 3rem 2rem;
    background: linear-gradient(135deg, #ffffff 0%, #f0fffe 100%);
    border-radius: 24px;
    box-shadow: 0 8px 32px rgba(79, 195, 195, 0.15);
  }

  .journey-highlight {
    font-size: 1.75rem;
    font-weight: 700;
    color: #4fc3c3;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    margin: 0 0 1rem 0;
  }

  .journey-main {
    font-size: 2.5rem;
    font-weight: 800;
    color: #1a2847;
    line-height: 1.3;
    margin: 0;
    letter-spacing: -0.02em;
  }

  .highlight-number {
    color: #f4d03f;
    font-size: 1.15em;
    font-weight: 900;
  }

  .highlight-years {
    color: #4fc3c3;
    font-weight: 900;
    position: relative;
  }

  .journey-closing {
    font-size: 1.5rem;
    font-weight: 600;
    color: #6b7280;
    line-height: 1.4;
    margin: 0;
  }

  .numbers-compact {
    display: flex;
    justify-content: center;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
    padding: 2rem 2rem;
    background: linear-gradient(135deg, #f0fffe 0%, white 100%);
    border-radius: 16px;
    border: 2px solid #4fc3c3;
    font-size: 1.125rem;
    color: #374151;
  }

  .stat-item {
    white-space: nowrap;
  }

  .stat-item strong {
    color: #111827;
    font-weight: 800;
    font-size: 1.3em;
  }

  .stat-item.highlight strong {
    color: #f4d03f;
    font-size: 1.5em;
  }

  .stat-divider {
    color: #4fc3c3;
    font-weight: 700;
    font-size: 1.5rem;
  }

  @media (max-width: 768px) {
    .journey-container {
      margin: 3rem auto;
    }

    .journey-hero {
      padding: 2.5rem 1.5rem;
    }

    .journey-highlight {
      font-size: 1.5rem;
      margin-bottom: 1rem;
    }

    .journey-main {
      font-size: 2rem;
    }

    .journey-closing {
      font-size: 1.25rem;
    }

    .numbers-compact {
      padding: 1.5rem 1rem;
      font-size: 1rem;
      gap: 0.75rem;
    }

    .stat-item strong {
      font-size: 1.2em;
    }

    .stat-item.highlight strong {
      font-size: 1.3em;
    }
  }

  @media (max-width: 480px) {
    .journey-hero {
      padding: 2rem 1.25rem;
    }

    .journey-highlight {
      font-size: 1.25rem;
      margin-bottom: 0.75rem;
    }

    .journey-main {
      font-size: 1.625rem;
    }

    .journey-closing {
      font-size: 1.125rem;
    }

    .numbers-compact {
      flex-direction: column;
      gap: 0.5rem;
      padding: 1.5rem 1rem;
      font-size: 0.938rem;
      align-items: center;
    }

    .equation-top {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      align-items: center;
      gap: 0.5rem;
    }

    .equals-sign {
      display: block;
      font-size: 1.5rem;
      margin: 0.25rem 0;
    }

    .result {
      display: block;
      text-align: center;
    }
  }
</style>

