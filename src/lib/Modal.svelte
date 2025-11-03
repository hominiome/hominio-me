<script lang="ts">
  import { browser } from "$app/environment";
  import type { Snippet } from "svelte";

  let {
    open = $bindable(true),
    onClose,
    children,
    variant = "default",
  } = $props<{
    open?: boolean;
    onClose: () => void;
    children?: Snippet;
    variant?: "default" | "danger";
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
      // Prevent scrolling - batch style changes to avoid forced reflow
      requestAnimationFrame(() => {
        document.body.style.position = "fixed";
        document.body.style.top = `-${scrollY}px`;
        document.body.style.width = "100%";
        document.body.style.overflow = "hidden";
      });

      return () => {
        // Restore scrolling - batch style changes and use requestAnimationFrame
        const savedScrollY = scrollY;
        requestAnimationFrame(() => {
          document.body.style.position = "";
          document.body.style.top = "";
          document.body.style.width = "";
          document.body.style.overflow = "";
          // Restore scroll position in next frame to avoid forced reflow
          requestAnimationFrame(() => {
            window.scrollTo(0, savedScrollY);
          });
        });
      };
    }
  });

  const modalBgColor = $derived(
    variant === "danger" ? "var(--color-alert-500)" : "rgba(255, 255, 255, 0.9)"
  );
</script>

{#if open}
  <div
    class="fixed inset-0 bottom-0 pb-[72px] bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-[30px] backdrop-saturate-[200%] flex items-end justify-center z-[1000] overflow-visible transition-opacity duration-200 px-1.5 @md:px-0"
    class:opacity-0={!open}
    class:opacity-100={open}
    style="-webkit-backdrop-filter: blur(30px) saturate(200%);"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
    role="dialog"
    aria-modal="true"
    aria-label="Modal dialog"
    tabindex="-1"
  >
    <div
      class="backdrop-blur-lg rounded-3xl pt-10 px-8 @md:px-12 pb-0 @xs:px-6 @xs:pt-7 w-full max-w-[700px] @md:max-w-[800px] relative shadow-[0_-4px_24px_rgba(0,0,0,0.15)] flex flex-col items-center mb-0 overflow-y-auto overflow-x-hidden transition-transform duration-300 ease-out"
      class:translate-y-full={!open}
      class:translate-y-0={open}
      style="max-height: calc(95vh - 72px); margin-top: 5vh; margin-bottom: 0; background-color: {modalBgColor};"
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
