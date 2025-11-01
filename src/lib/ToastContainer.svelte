<script>
  import Toast from "./Toast.svelte";
  import { toasts, removeToast } from "./toastStore.js";
</script>

<div class="toast-container">
  {#each $toasts as toast (toast.id)}
    <Toast
      message={toast.message}
      type={toast.type}
      duration={toast.duration}
      onclose={() => removeToast(toast.id)}
    />
  {/each}
</div>

<style>
  .toast-container {
    position: fixed;
    top: 0;
    right: 0;
    z-index: 10000;
    pointer-events: none;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
  }

  .toast-container :global(.toast) {
    pointer-events: auto;
  }

  @media (max-width: 640px) {
    .toast-container {
      padding: 0.5rem;
    }
  }
</style>
