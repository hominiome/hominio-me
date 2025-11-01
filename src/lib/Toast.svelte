<script>
  let { message, type = "info", duration = 5000 } = $props();
  let visible = $state(true);
  let progress = $state(100);

  $effect(() => {
    if (duration > 0) {
      const startTime = Date.now();
      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        progress = Math.max(0, 100 - (elapsed / duration) * 100);

        if (elapsed >= duration) {
          visible = false;
          clearInterval(interval);
        }
      }, 50);

      return () => clearInterval(interval);
    }
  });

  function close() {
    visible = false;
  }
</script>

{#if visible}
  <div class="toast toast-{type}" role="alert">
    <div class="toast-content">
      <div class="toast-icon">
        {#if type === "success"}
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M5 13l4 4L19 7"
            />
          </svg>
        {:else if type === "error"}
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        {:else}
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        {/if}
      </div>
      <p class="toast-message">{message}</p>
      <button onclick={close} class="toast-close" aria-label="Close">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
    {#if duration > 0}
      <div class="toast-progress">
        <div class="toast-progress-bar" style="width: {progress}%"></div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .toast {
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 10000;
    min-width: 300px;
    max-width: 500px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(26, 26, 78, 0.15);
    border: 2px solid;
    animation: slideIn 0.3s ease-out;
    overflow: hidden;
  }

  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  .toast-success {
    border-color: #4ecdc4;
  }

  .toast-error {
    border-color: #ef4444;
  }

  .toast-info {
    border-color: #4ecdc4;
  }

  .toast-content {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem 1.25rem;
  }

  .toast-icon {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
  }

  .toast-success .toast-icon {
    color: #4ecdc4;
  }

  .toast-error .toast-icon {
    color: #ef4444;
  }

  .toast-info .toast-icon {
    color: #4ecdc4;
  }

  .toast-message {
    flex: 1;
    margin: 0;
    font-weight: 600;
    font-size: 0.9375rem;
    color: #1a1a4e;
    line-height: 1.5;
  }

  .toast-close {
    flex-shrink: 0;
    background: none;
    border: none;
    padding: 0.25rem;
    cursor: pointer;
    color: rgba(26, 26, 78, 0.4);
    transition: color 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .toast-close:hover {
    color: #1a1a4e;
  }

  .toast-close svg {
    width: 18px;
    height: 18px;
  }

  .toast-progress {
    height: 3px;
    background: rgba(26, 26, 78, 0.05);
    overflow: hidden;
  }

  .toast-progress-bar {
    height: 100%;
    transition: width 0.05s linear;
  }

  .toast-success .toast-progress-bar {
    background: #4ecdc4;
  }

  .toast-error .toast-progress-bar {
    background: #ef4444;
  }

  .toast-info .toast-progress-bar {
    background: #4ecdc4;
  }

  @media (max-width: 640px) {
    .toast {
      top: 0.5rem;
      right: 0.5rem;
      left: 0.5rem;
      min-width: auto;
      max-width: none;
    }
  }
</style>
