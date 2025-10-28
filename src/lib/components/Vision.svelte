<script>
</script>

<div class="vision">
  <div class="vision-section">
    <h3 class="vision-heading">Picture This</h3>
    <p class="vision-big-text">
      <span class="number-inline">1 billion</span> humans,
    </p>
    <p class="vision-big-text">
      bringing your vision of a greater tomorrow to life—
    </p>
    <p class="vision-big-text">
      with just <span class="number-inline">€1 each</span>.
    </p>
    <p class="vision-text-center">
      Just imagine what we could build with this collective power.
    </p>
  </div>

  <!-- Founder Quote -->
  <div class="founder-quote">
    <img src="/hominiono1.jpg" alt="Samuel Andert" class="founder-image" />
    <div class="quote-content">
      <blockquote class="quote-text">
        I see us building <em>civilization-upgrading visions</em> that reshape
        how we live and work tomorrow.
      </blockquote>
      <p class="quote-author">— Samuel Andert, Founder of Hominio</p>
    </div>
  </div>
</div>

<style>
  .vision {
    max-width: 800px;
    margin: 0 auto 4rem auto;
  }

  .vision-section {
    margin-bottom: 3rem;
    padding: 2.5rem 2rem;
    background: white;
    border-radius: 16px;
    box-shadow: 0 2px 16px rgba(0, 0, 0, 0.06);
  }

  .vision-heading {
    font-size: 0.938rem;
    font-weight: 800;
    color: #4fc3c3;
    margin: 0 0 1.5rem 0;
    text-transform: uppercase;
    letter-spacing: 0.15em;
  }

  .vision-big-text {
    font-size: 1.5rem;
    line-height: 1.6;
    color: #111827;
    margin: 0 0 1.5rem 0;
    font-weight: 500;
  }

  .number-inline {
    color: #f4d03f;
    font-weight: 800;
    font-size: 1.15em;
  }

  .vision-text-center {
    font-size: 1.125rem;
    line-height: 1.8;
    color: #4b5563;
    margin: 0;
    text-align: center;
  }

  /* Founder Quote */
  .founder-quote {
    display: flex;
    align-items: center;
    gap: 2rem;
    margin-top: 3rem;
    padding: 2.5rem;
    background: linear-gradient(135deg, #f0fffe 0%, white 100%);
    border-radius: 16px;
    border-left: 4px solid #4fc3c3;
    box-shadow: 0 2px 16px rgba(0, 0, 0, 0.06);
  }

  .founder-image {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
    border: 3px solid #4fc3c3;
    box-shadow: 0 4px 12px rgba(79, 195, 195, 0.2);
  }

  .quote-content {
    flex: 1;
    text-align: left;
  }

  .quote-text {
    font-size: 1.25rem;
    line-height: 1.7;
    color: #111827;
    font-style: italic;
    margin: 0 0 1rem 0;
    font-weight: 500;
  }

  .quote-text em {
    color: #4fc3c3;
    font-style: italic;
    font-weight: 700;
  }

  .quote-author {
    font-size: 1rem;
    color: #6b7280;
    font-weight: 600;
    margin: 0;
  }

  @media (max-width: 768px) {
    .vision {
      margin-bottom: 3rem;
    }

    .vision-section {
      padding: 2rem 1.5rem;
    }

    .vision-heading {
      font-size: 0.875rem;
    }

    .vision-big-text {
      font-size: 1.25rem;
    }

    .vision-text-center {
      font-size: 1rem;
    }

    .founder-quote {
      flex-direction: column;
      text-align: center;
      gap: 1.5rem;
      padding: 2rem;
    }

    .founder-image {
      width: 100px;
      height: 100px;
    }

    .quote-content {
      text-align: center;
    }

    .quote-text {
      font-size: 1.125rem;
    }

    .quote-author {
      font-size: 0.938rem;
    }
  }

  @media (max-width: 480px) {
    .vision-section {
      padding: 1.75rem 1.25rem;
    }

    .vision-big-text {
      font-size: 1.125rem;
    }

    .founder-quote {
      padding: 1.5rem;
    }

    .founder-image {
      width: 80px;
      height: 80px;
    }

    .quote-text {
      font-size: 1.063rem;
    }
  }
</style>

