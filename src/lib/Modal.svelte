<script lang="ts">
  let { open = $bindable(true), onClose } = $props<{
    open?: boolean;
    onClose: () => void;
  }>();

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  function handleClose() {
    onClose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      onClose();
    }
  }
</script>

{#if open}
  <div
    class="modal-backdrop"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <div class="modal-content" onclick={(e) => e.stopPropagation()}>
      <!-- Content Slot -->
      <div class="modal-body">
        <slot />
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    bottom: 0; /* Extend all the way to bottom */
    padding-bottom: 60px; /* Consistent 60px navbar height everywhere */
    background: linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.2) 0%,
      rgba(255, 255, 255, 0.1) 100%
    );
    backdrop-filter: blur(30px) saturate(200%);
    -webkit-backdrop-filter: blur(30px) saturate(200%);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    z-index: 1000; /* Lower than navbar (10000) */
    animation: fadeIn 0.2s;
    /* Prevent iOS scroll gap */
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .modal-content {
    background: white;
    border-radius: 24px 24px 0 0;
    padding: 2.5rem 2rem;
    padding-bottom: 0;
    width: 100%;
    max-width: 600px;
    max-height: calc(100vh - 60px); /* Consistent 60px navbar height */
    overflow-y: auto;
    position: relative;
    animation: slideUp 0.3s ease-out;
    box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.15);
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 0; /* No gap - touch navbar directly */
    /* Prevent iOS scroll gap */
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
  }

  @media (max-width: 768px) {
    .modal-content {
      padding: 1.75rem 1.5rem;
      padding-bottom: 0;
      max-height: calc(100vh - 60px); /* Consistent 60px navbar height */
    }
  }

  .modal-body {
    width: 100%;
    flex: 1;
    /* No extra padding needed - margin-bottom on modal-content handles spacing */
  }

  @keyframes slideUp {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }
</style>
