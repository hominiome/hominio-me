<script lang="ts">
  import Icon from "@iconify/svelte";

  let { unreadCount, onClick, latestTitle, latestIcon, latestMessage } =
    $props<{
      unreadCount: number;
      onClick: () => void;
      latestTitle?: string;
      latestIcon?: string;
      latestMessage?: string;
    }>();

  let previousCount = $state(0);
  let animateStack = $state(false);

  const hasUnread = $derived(unreadCount > 0);

  // Show stacked previews if there are 2+ notifications (max 3 additional stacked)
  const stackedCount = $derived(
    unreadCount > 1 ? Math.min(unreadCount - 1, 3) : 0
  );

  // Trigger animation when new notifications arrive
  $effect(() => {
    if (unreadCount > previousCount && previousCount > 0) {
      // New notification arrived
      animateStack = true;
      setTimeout(() => {
        animateStack = false;
      }, 600); // Animation duration
    }
    previousCount = unreadCount;
  });

  function handleClick() {
    onClick();
  }
</script>

{#if hasUnread}
  <div class="notification-bell-container">
    <!-- Stacked previews (fake) - stacked to the right -->
    {#if stackedCount > 0}
      {#each Array(stackedCount) as _, i}
        <div
          class="stacked-preview"
          class:animate={animateStack}
          style="--translate-x: {(stackedCount - i) *
            -4}px; --final-opacity: {0.3 - i * 0.08}; z-index: {1000 -
            i}; animation-delay: {i * 0.1}s;"
        >
          <div class="stacked-preview-border"></div>
        </div>
      {/each}
    {/if}

    <!-- Liquid glass wrapper -->
    <div class="glass-wrapper">
      <!-- Main notification preview - navbar height -->
      <button
        class="notification-preview"
        onclick={handleClick}
        aria-label={`${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`}
      >
        <div class="preview-content">
          <div class="icon-badge-group">
            <Icon icon="mdi:bell" class="preview-icon bell-icon" />
            <div class="preview-text">
              {#if latestTitle && typeof latestTitle === "string" && latestTitle.trim() !== ""}
                <div class="preview-title">{latestTitle}</div>
              {:else}
                <!-- Only show fallback if we truly have no title (shouldn't happen normally) -->
                <div class="preview-title">New notification</div>
              {/if}
            </div>
            {#if unreadCount > 0}
              <span class="notification-badge"
                >{unreadCount > 99 ? "99+" : unreadCount}</span
              >
            {/if}
          </div>
          <div class="chevron-icon">
            <Icon icon="mdi:chevron-up" />
          </div>
        </div>
      </button>
    </div>
  </div>
{/if}

<style>
  .notification-bell-container {
    position: fixed;
    bottom: 60px;
    left: 0;
    right: 0;
    width: 100%;
    z-index: 1001;
    display: flex;
    flex-direction: row;
    align-items: flex-end;
    justify-content: center;
    gap: 0;
  }

  .stacked-preview {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 100%;
    height: 80px;
    pointer-events: none;
    transform: translateX(var(--translate-x, 0px));
    opacity: var(--final-opacity, 0.3);
    transition: all 0.3s ease;
  }

  .stacked-preview.animate {
    animation: stackSlideIn 0.6s ease-out forwards;
  }

  @keyframes stackSlideIn {
    0% {
      transform: translateX(12px) scale(0.7);
      opacity: 0;
    }
    50% {
      transform: translateX(calc(var(--translate-x, 0px) + 4px)) scale(1.05);
      opacity: calc(var(--final-opacity, 0.3) + 0.2);
    }
    100% {
      transform: translateX(var(--translate-x, 0px)) scale(1);
      opacity: var(--final-opacity, 0.3);
    }
  }

  .stacked-preview-border {
    width: 100%;
    height: 100%;
    background: white;
    border: 1px solid rgba(26, 26, 78, 0.1);
    border-left: none;
    border-radius: 0 16px 16px 0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  }

  .glass-wrapper {
    position: relative;
    width: 100%;
    padding: 1.25rem 1.25rem 0 1.25rem;
    background: linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.2) 0%,
      rgba(255, 255, 255, 0.1) 100%
    );
    backdrop-filter: blur(30px) saturate(200%);
    -webkit-backdrop-filter: blur(30px) saturate(200%);
    border-radius: 24px 24px 0 0;
    border: 1px solid rgba(255, 255, 255, 0.4);
    border-bottom: none;
    box-shadow:
      0 -8px 32px rgba(0, 0, 0, 0.15),
      inset 0 2px 4px rgba(255, 255, 255, 0.5),
      inset 0 -2px 4px rgba(255, 255, 255, 0.2),
      0 0 0 1px rgba(255, 255, 255, 0.1) inset;
    z-index: 1002;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    margin-bottom: -1px;
  }

  .notification-preview {
    position: relative;
    background: white;
    border: none;
    border-radius: 24px 24px 0 0;
    width: 100%;
    max-width: 600px;
    height: 64px;
    padding: 0 1.25rem;
    display: flex;
    align-items: center;
    cursor: pointer;
    box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.15);
    transition: all 0.3s ease;
    z-index: 1;
    overflow: visible;
    margin: 0 auto;
  }

  .preview-content {
    display: flex;
    align-items: center;
    gap: 1rem;
    width: 100%;
    min-height: 0;
    overflow: visible;
  }

  .icon-badge-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
    min-width: 0;
    position: relative;
    justify-content: flex-start;
  }

  .notification-badge {
    background: linear-gradient(135deg, #f4d03f 0%, #fcd34d 100%);
    color: #1a1a4e;
    border-radius: 12px;
    min-width: 2.25rem;
    width: auto;
    height: 2.25rem;
    padding: 0 0.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;
    font-weight: 900;
    line-height: 1;
    flex-shrink: 0;
    position: static;
    margin-left: auto;
    border: 1px solid rgba(244, 208, 63, 0.3);
    box-shadow: 0 2px 4px rgba(244, 208, 63, 0.2);
    outline: none;
  }

  .preview-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    overflow: hidden;
    text-align: left;
  }

  .preview-title {
    font-size: 0.9375rem;
    font-weight: 700;
    color: #1a1a4e;
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chevron-icon {
    width: 1.75rem;
    height: 1.75rem;
    color: rgba(26, 26, 78, 0.5);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .chevron-icon :global(svg) {
    width: 100%;
    height: 100%;
  }

  @media (max-width: 768px) {
    .notification-bell-container {
      bottom: 60px;
      left: 0;
      right: 0;
      transform: none;
      width: 100%;
      padding: 0;
      margin: 0;
    }

    .glass-wrapper {
      width: 100%;
      padding: 1rem 1rem 0 1rem;
      border-radius: 20px 20px 0 0;
      margin: 0;
      margin-bottom: -1px;
    }

    .notification-preview {
      width: 100%;
      height: 56px;
      padding: 0 1rem;
      border-radius: 12px 12px 0 0;
      border-bottom: none;
    }

    .icon-badge-group {
      gap: 0.375rem;
    }

    .notification-badge {
      min-width: 2rem;
      width: auto;
      height: 2rem;
      font-size: 0.9375rem;
      padding: 0 0.625rem;
      position: static;
      border-radius: 10px;
      line-height: 1;
      margin-left: auto;
      border: 1px solid rgba(244, 208, 63, 0.3);
      box-shadow: 0 2px 4px rgba(244, 208, 63, 0.2);
      outline: none;
      background: linear-gradient(135deg, #f4d03f 0%, #fcd34d 100%);
      color: #1a1a4e;
    }

    .preview-title {
      font-size: 0.875rem;
      color: #1a1a4e;
    }

    .chevron-icon {
      width: 1.5rem;
      height: 1.5rem;
    }
  }
</style>
