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
    class="fixed inset-0 bottom-0 pb-[60px] bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-[30px] backdrop-saturate-[200%] flex items-end justify-center z-[1000] animate-[fadeIn_0.2s_ease-out] overflow-visible"
    style="-webkit-backdrop-filter: blur(30px) saturate(200%);"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
    role="dialog"
    aria-modal="true"
    aria-label="Modal dialog"
    tabindex="-1"
  >
    <div 
      class="bg-white/90 backdrop-blur-lg rounded-t-3xl pt-10 px-8 pb-0 @xs:px-6 @xs:pt-7 w-full max-w-[700px] max-h-[calc(100vh-60px)] relative animate-[slideUp_0.3s_ease-out] shadow-[0_-4px_24px_rgba(0,0,0,0.15)] flex flex-col items-center mb-0 overflow-y-auto overflow-x-hidden"
    >
      <!-- Content (Svelte 5: using snippet prop instead of slot) -->
      <div class="w-full flex-1 pb-6 @xs:pb-5">
        {#if children}
          {@render children()}
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes slideUp {
    from {
      transform: translateY(calc(100% + 60px));
    }
    to {
      transform: translateY(0);
    }
  }
</style>
