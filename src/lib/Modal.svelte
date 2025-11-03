<script lang="ts">
  import { browser } from "$app/environment";
  import type { Snippet } from "svelte";

  let { 
    open = $bindable(true), 
    onClose,
    children 
  } = $props<{
    open?: boolean;
    onClose: () => void;
    children?: Snippet;
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
    } else if (e.key === "Enter" || e.key === " ") {
      // Handle Enter/Space for backdrop click accessibility
      if (e.target === e.currentTarget) {
        e.preventDefault();
        onClose();
      }
    }
  }

  // Prevent background scrolling when modal is open
  $effect(() => {
    if (browser && open) {
      // Save current scroll position
      const scrollY = window.scrollY;
      // Prevent scrolling
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = "100%";
      document.body.style.overflow = "hidden";

      return () => {
        // Restore scrolling
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.width = "";
        document.body.style.overflow = "";
        // Restore scroll position
        window.scrollTo(0, scrollY);
      };
    }
  });
</script>

{#if open}
  <div
    class="modal-backdrop"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
    role="dialog"
    aria-modal="true"
    aria-label="Modal dialog"
    tabindex="-1"
  >
    <div 
      class="modal-content"
    >
      <!-- Content (Svelte 5: using snippet prop instead of slot) -->
      <div class="modal-body">
        {#if children}
          {@render children()}
        {/if}
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
      rgba(255, 255, 255, 0.1) 0%,
      rgba(255, 255, 255, 0.05) 100%
    ); /* 90% transparent (10% opacity) */
    backdrop-filter: blur(30px) saturate(200%);
    -webkit-backdrop-filter: blur(30px) saturate(200%);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    z-index: 1000; /* Lower than navbar (10000) */
    animation: fadeIn 0.2s;
    overflow: visible; /* Allow modal content to expand fully */
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
    max-width: 700px; /* Increased from 600px for desktop */
    max-height: calc(100vh - 60px); /* Consistent 60px navbar height */
    position: relative;
    animation: slideUp 0.3s ease-out;
    box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.15);
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 0; /* No gap - touch navbar directly */
    overflow-y: auto; /* Allow scrolling inside modal */
    overflow-x: hidden;
  }

  .modal-body {
    width: 100%;
    flex: 1;
    padding-bottom: calc(
      1.5rem
    ); /* Standardized bottom padding: navbar height + extra spacing */
  }

  @media (max-width: 768px) {
    .modal-content {
      padding: 1.75rem 1.5rem;
      padding-bottom: 0;
    }

    .modal-body {
      padding-bottom: calc(
        1.25rem
      ); /* Mobile: navbar height + slightly less spacing */
    }
  }

  @keyframes slideUp {
    from {
      transform: translateY(
        calc(100% + 60px)
      ); /* Start from navbar top edge (60px above browser bottom) */
    }
    to {
      transform: translateY(0);
    }
  }
</style>
