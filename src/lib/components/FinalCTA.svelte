<script>
</script>

<div class="final-cta">
  <div class="cta-content">
    <p class="cta-greeting">Hey visionary you,</p>
    
    <h2 class="cta-headline">
      This is your once-in-a-lifetime opportunity<br />
      to show the world your full potential.
    </h2>
    
    <p class="cta-text">
      Let's build history together.
    </p>
    
    <p class="cta-question">
      What's the biggest vision you carry deep in your heart?
    </p>
    
    <p class="cta-text">
      Let's make it happen together.
    </p>
    
    <p class="cta-text">
      I'm looking forward to talking to you.
    </p>
    
    <div class="cta-final-question">
      <p class="cta-call">Will you answer the call?</p>
      <a 
        href="https://instagram.com/samuelandert" 
        target="_blank" 
        rel="noopener noreferrer"
        class="cta-action-button"
      >
        Message Me to Apply
      </a>
    </div>
    
    <div class="cta-founder">
      <img src="/hominiono1.jpg" alt="Samuel Andert" class="founder-avatar" />
      <p class="cta-signature">— Samuel Andert, Founder of Hominio</p>
    </div>
  </div>
</div>

<style>
  .final-cta {
    max-width: 800px;
    margin: 5rem auto 4rem auto;
    padding: 4rem 3rem;
    background: linear-gradient(135deg, #1a2847 0%, #2a3a5f 100%);
    border-radius: 24px;
    box-shadow: 0 12px 48px rgba(26, 40, 71, 0.3);
    text-align: center;
    position: relative;
    overflow: hidden;
  }

  .final-cta::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, #f4d03f 0%, #4fc3c3 100%);
  }

  .cta-content {
    position: relative;
    z-index: 1;
  }

  .cta-greeting {
    font-size: 1.5rem;
    color: #4fc3c3;
    font-weight: 600;
    margin: 0 0 2rem 0;
    font-style: italic;
  }

  .cta-headline {
    font-size: 2.5rem;
    font-weight: 800;
    color: white;
    line-height: 1.2;
    margin: 0 0 2.5rem 0;
    letter-spacing: -0.02em;
  }

  .cta-text {
    font-size: 1.25rem;
    line-height: 1.8;
    color: #e5e7eb;
    margin: 0 0 1.5rem 0;
  }

  .cta-question {
    font-size: 1.5rem;
    font-weight: 700;
    color: #f4d03f;
    line-height: 1.6;
    margin: 2.5rem 0;
    font-style: italic;
  }

  .cta-final-question {
    margin: 3rem 0 2rem 0;
  }

  .cta-call {
    font-size: 1.75rem;
    font-weight: 700;
    color: white;
    margin: 0 0 2rem 0;
    letter-spacing: -0.01em;
  }

  .cta-action-button {
    display: inline-block;
    padding: 1.25rem 3rem;
    background: linear-gradient(135deg, #f4d03f 0%, #f0c419 100%);
    color: #1a2847;
    text-decoration: none;
    font-size: 1.25rem;
    font-weight: 700;
    border-radius: 50px;
    box-shadow: inset 0 0 0 3px #1a2847, 0 8px 32px rgba(244, 208, 63, 0.4);
    transition: all 0.3s;
    letter-spacing: 0.02em;
  }

  .cta-action-button:hover {
    transform: translateY(-4px);
    box-shadow: inset 0 0 0 3px #1a2847, 0 12px 40px rgba(244, 208, 63, 0.6);
    background: linear-gradient(135deg, #f7dc5f 0%, #f3cd39 100%);
  }

  .cta-founder {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    margin-top: 3rem;
  }

  .founder-avatar {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    object-fit: cover;
    border: 3px solid #4fc3c3;
    box-shadow: 0 4px 16px rgba(79, 195, 195, 0.3);
  }

  .cta-signature {
    font-size: 1rem;
    color: #9ca3af;
    font-style: italic;
    margin: 0;
    font-weight: 500;
  }

  @media (max-width: 768px) {
    .final-cta {
      margin: 4rem auto 3rem auto;
      padding: 3rem 2rem;
    }

    .cta-greeting {
      font-size: 1.25rem;
      margin-bottom: 1.5rem;
    }

    .cta-headline {
      font-size: 2rem;
      margin-bottom: 2rem;
    }

    .cta-text {
      font-size: 1.125rem;
    }

    .cta-question {
      font-size: 1.25rem;
      margin: 2rem 0;
    }

    .cta-call {
      font-size: 1.5rem;
      margin-bottom: 1.5rem;
    }

    .cta-action-button {
      font-size: 1.125rem;
      padding: 1.125rem 2.5rem;
    }

    .cta-founder {
      margin-top: 2.5rem;
      gap: 0.875rem;
    }

    .founder-avatar {
      width: 70px;
      height: 70px;
    }

    .cta-signature {
      font-size: 0.938rem;
    }
  }

  @media (max-width: 480px) {
    .final-cta {
      padding: 2.5rem 0.375rem; /* 6px = 0.375rem */
      margin: 3rem auto 2.5rem auto;
    }

    .cta-greeting {
      font-size: 1.125rem;
      margin-bottom: 1.25rem;
    }

    .cta-headline {
      font-size: 1.75rem;
      margin-bottom: 1.75rem;
    }

    .cta-text {
      font-size: 1.063rem;
      margin-bottom: 1.25rem;
    }

    .cta-question {
      font-size: 1.125rem;
      margin: 1.75rem 0;
    }

    .cta-call {
      font-size: 1.25rem;
      margin-bottom: 1.25rem;
    }

    .cta-action-button {
      font-size: 1rem;
      padding: 1rem 2rem;
    }

    .cta-founder {
      margin-top: 2rem;
      gap: 0.75rem;
    }

    .founder-avatar {
      width: 60px;
      height: 60px;
    }

    .cta-signature {
      font-size: 0.875rem;
    }
  }
</style>

