<script lang="ts">
  interface Props {
    message?: string;
    size?: number;
  }

  let { message = "Loading...", size = 120 }: Props = $props();
</script>

<div class="loading-container">
  <div class="logo-wrapper">
    <img 
      src="/logo.png" 
      alt="Hominio" 
      class="logo"
      style="width: {size}px; height: {size}px;"
    />
  </div>
  {#if message}
    <p class="loading-message">{message}</p>
  {/if}
</div>

<style>
  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
    padding: 2rem;
  }

  .logo-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .logo {
    object-fit: contain;
    animation: pump 2s ease-in-out infinite;
    will-change: transform;
  }

  @keyframes pump {
    0%, 100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.15);
    }
  }

  .loading-message {
    font-size: 1.125rem;
    color: var(--color-brand-navy-700);
    margin: 0;
    font-family: var(--font-family-body);
  }
</style>

