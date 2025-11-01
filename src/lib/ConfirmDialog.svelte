<script>
  let {
    open = $bindable(false),
    title = "Confirm Action",
    message = "Are you sure you want to proceed?",
    confirmText = "Confirm",
    cancelText = "Cancel",
    variant = "primary", // "primary" or "danger"
    onConfirm,
    onCancel,
  } = $props();

  const confirmClass = $derived(
    variant === "danger" ? "btn-danger" : "btn-primary"
  );

  function handleConfirm() {
    if (onConfirm) {
      onConfirm();
    }
    open = false;
  }

  function handleCancel() {
    if (onCancel) {
      onCancel();
    }
    open = false;
  }

  function handleKeydown(e) {
    if (e.key === "Escape") {
      handleCancel();
    } else if (e.key === "Enter" && e.ctrlKey) {
      handleConfirm();
    }
  }
</script>

{#if open}
  <div
    class="confirm-overlay"
    onclick={handleCancel}
    onkeydown={handleKeydown}
    role="dialog"
    aria-modal="true"
    aria-labelledby="confirm-title"
    tabindex="-1"
  >
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="confirm-dialog" onclick={(e) => e.stopPropagation()}>
      <div class="confirm-header">
        <h2 id="confirm-title" class="confirm-title">{title}</h2>
        <button
          class="confirm-close"
          onclick={handleCancel}
          aria-label="Close"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div class="confirm-content">
        <p class="confirm-message">{message}</p>
      </div>

      <div class="confirm-actions">
        <button
          type="button"
          onclick={handleCancel}
          class="btn-cancel"
        >
          {cancelText}
        </button>
        <button
          type="button"
          onclick={handleConfirm}
          class={confirmClass}
        >
          {confirmText}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .confirm-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    padding: 1rem;
    animation: fadeIn 0.2s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .confirm-dialog {
    background: white;
    border-radius: 16px;
    max-width: 500px;
    width: 100%;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    animation: slideUp 0.2s ease-out;
    overflow: hidden;
  }

  @keyframes slideUp {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .confirm-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem;
    border-bottom: 1px solid rgba(26, 26, 78, 0.1);
  }

  .confirm-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #1a1a4e;
    margin: 0;
  }

  .confirm-close {
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    border: none;
    background: rgba(26, 26, 78, 0.1);
    color: #1a1a4e;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    padding: 0;
  }

  .confirm-close:hover {
    background: rgba(26, 26, 78, 0.2);
    transform: rotate(90deg);
  }

  .confirm-close svg {
    width: 1.25rem;
    height: 1.25rem;
  }

  .confirm-content {
    padding: 1.5rem;
  }

  .confirm-message {
    color: rgba(26, 26, 78, 0.8);
    font-size: 1rem;
    line-height: 1.6;
    margin: 0;
    white-space: pre-line;
  }

  .confirm-actions {
    display: flex;
    gap: 0.75rem;
    padding: 1.5rem;
    border-top: 1px solid rgba(26, 26, 78, 0.1);
    justify-content: flex-end;
  }

  .btn-cancel {
    padding: 0.75rem 1.5rem;
    background: white;
    color: #1a1a4e;
    border: 2px solid rgba(26, 26, 78, 0.2);
    border-radius: 8px;
    font-weight: 600;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-cancel:hover {
    background: rgba(26, 26, 78, 0.05);
    border-color: rgba(26, 26, 78, 0.3);
  }

  .btn-primary {
    padding: 0.75rem 1.5rem;
    background: linear-gradient(135deg, #4ecdc4 0%, #1a1a4e 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-primary:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(78, 205, 196, 0.3);
  }

  .btn-danger {
    padding: 0.75rem 1.5rem;
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-danger:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
  }
</style>

