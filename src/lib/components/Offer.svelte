<script>
  // Example calculation
  const users = 1000;
  const minutesPerDay = 10;
  const centsPerMinute = 1;
  
  const dailyRevenue = users * minutesPerDay * centsPerMinute;
  const monthlyRevenue = dailyRevenue * 30;
  const yearlyRevenue = monthlyRevenue * 12;
</script>

<div class="offer-section">
  <div class="offer-container">
    <div class="offer-content">
      <div class="offer-left">
        <h2 class="offer-title">
          We not only build vibes for you for FREE,
          <span class="offer-emphasis">we even pay you.</span>
        </h2>
        <p class="offer-text">
          Sign up to the waitlist now and drop us a short note about your business use case. We'll build a custom Vibe that connects your customers directly with your offers—no apps, no friction, just voice.
        </p>
        <p class="offer-cta">
          Don't sleep on this hidden gem. Before everyone else discovers voice-native Vibes, be the first to excite your customers with the future of interaction.
        </p>
      </div>

      <div class="offer-right">
        <div class="calculation-card">
          <h3 class="calculation-title">Example Calculation</h3>
          <div class="calculation-example">
            <div class="calculation-line">
              <span class="calculation-label">{users.toLocaleString()} users</span>
              <span class="calculation-operator">×</span>
              <span class="calculation-label">{minutesPerDay} minutes/day</span>
              <span class="calculation-operator">×</span>
              <span class="calculation-label">{centsPerMinute}¢/minute</span>
            </div>
            <div class="calculation-result">
              <div class="result-item">
                <span class="result-label">Daily Revenue:</span>
                <span class="result-value">${(dailyRevenue / 100).toLocaleString()}</span>
              </div>
              <div class="result-item">
                <span class="result-label">Monthly Revenue:</span>
                <span class="result-value">${(monthlyRevenue / 100).toLocaleString()}</span>
              </div>
              <div class="result-item highlight">
                <span class="result-label">Yearly Revenue:</span>
                <span class="result-value">${(yearlyRevenue / 100).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .offer-section {
    background: linear-gradient(180deg, #faf8f5 0%, #fefdfb 100%);
    padding: 6rem 1.5rem;
  }

  .offer-container {
    max-width: 1200px;
    margin: 0 auto;
  }

  .offer-content {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 3rem;
    align-items: start;
  }

  .offer-left {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    justify-content: center;
  }

  .offer-title {
    font-size: 2.75rem;
    font-weight: 700;
    color: var(--color-primary-500);
    margin: 0;
    line-height: 1.3;
    letter-spacing: -0.02em;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .offer-emphasis {
    display: block;
    font-size: 3rem;
    font-weight: 800;
    color: var(--color-secondary-500);
    line-height: 1.2;
    margin-top: 0.25rem;
  }

  .offer-text {
    font-size: 1.375rem;
    line-height: 1.8;
    color: var(--color-primary-600);
    margin: 0;
    font-weight: 400;
  }

  .offer-cta {
    font-size: 1.25rem;
    line-height: 1.7;
    color: var(--color-secondary-500);
    margin: 1.5rem 0 0 0;
    font-weight: 600;
    font-style: italic;
  }

  .offer-right {
    display: flex;
    flex-direction: column;
  }

  .calculation-card {
    background: linear-gradient(135deg, var(--color-secondary-50) 0%, var(--color-accent-50) 100%);
    border-radius: 1rem;
    padding: 2rem;
    border: 2px solid var(--color-secondary-200);
  }

  .calculation-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-primary-500);
    margin: 0 0 1.5rem 0;
    text-align: center;
  }

  .calculation-example {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .calculation-line {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    padding: 1rem;
    background: white;
    border-radius: 0.5rem;
  }

  .calculation-label {
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-primary-600);
  }

  .calculation-operator {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-secondary-500);
  }

  .calculation-result {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .result-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.5rem;
    background: white;
    border-radius: 0.5rem;
    border: 2px solid transparent;
  }

  .result-item.highlight {
    background: linear-gradient(135deg, var(--color-secondary-500) 0%, var(--color-accent-500) 100%);
    border-color: var(--color-secondary-500);
  }

  .result-label {
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-primary-600);
  }

  .result-item.highlight .result-label {
    color: white;
  }

  .result-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-primary-500);
  }

  .result-item.highlight .result-value {
    color: white;
    font-size: 1.75rem;
  }

  @media (max-width: 1024px) {
    .offer-content {
      grid-template-columns: 1fr;
      gap: 2rem;
    }
  }

  @media (max-width: 768px) {
    .offer-section {
      padding: 4rem 1rem;
    }

    .offer-title {
      font-size: 2rem;
    }

    .offer-emphasis {
      font-size: 2.25rem;
    }

    .offer-text {
      font-size: 1.125rem;
    }

    .offer-cta {
      font-size: 1.125rem;
      margin-top: 1.25rem;
    }

    .calculation-card {
      padding: 1.5rem;
    }

    .calculation-line {
      flex-direction: column;
      gap: 0.5rem;
    }

    .calculation-operator {
      transform: rotate(90deg);
    }

    .result-item {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
    }

    .result-value {
      font-size: 1.25rem;
    }

    .result-item.highlight .result-value {
      font-size: 1.5rem;
    }
  }

  @media (max-width: 480px) {
    .offer-title {
      font-size: 1.75rem;
    }

    .offer-emphasis {
      font-size: 2rem;
    }

    .offer-text {
      font-size: 1.125rem;
    }

    .offer-cta {
      font-size: 1rem;
      margin-top: 1rem;
    }

    .offer-badge {
      font-size: 0.75rem;
      padding: 0.375rem 1rem;
    }
  }
</style>
