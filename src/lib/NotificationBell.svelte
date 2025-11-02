<script lang="ts">
  let { 
    unreadCount, 
    onClick,
    latestTitle 
  } = $props<{
    unreadCount: number;
    onClick: () => void;
    latestTitle?: string;
  }>();

  let previousCount = $state(0);
  let animateStack = $state(false);

  const hasUnread = $derived(unreadCount > 0);
  const displayTitle = $derived(
    latestTitle 
      ? (latestTitle.length > 20 ? latestTitle.substring(0, 20) + "..." : latestTitle)
      : ""
  );
  
  // Show stacked previews if there are 2+ notifications (max 3 total including the main one)
  const stackedCount = $derived(
    unreadCount > 1 ? Math.min(unreadCount - 1, 2) : 0
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
</script>

{#if hasUnread}
  <div class="notification-bell-container">
    <!-- Stacked previews (fake) -->
    {#if stackedCount > 0}
      {#each Array(stackedCount) as _, i}
        <div 
          class="stacked-preview" 
          class:animate={animateStack}
          style="--translate-y: {(stackedCount - i) * 4}px; --final-opacity: {0.4 - (i * 0.15)}; z-index: {1000 - i}; animation-delay: {i * 0.1}s;"
        >
          <div class="stacked-preview-border"></div>
        </div>
      {/each}
    {/if}
    
    <!-- Main notification bell -->
    <button 
      class="notification-bell" 
      class:wiggle={hasUnread}
      onclick={onClick}
      aria-label={`${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`}
    >
      <svg 
        class="bell-icon" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path 
          stroke-linecap="round" 
          stroke-linejoin="round" 
          stroke-width="2" 
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        />
      </svg>
      {#if unreadCount > 0}
        <span class="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
      {/if}
      {#if displayTitle}
        <span class="notification-title-text">{displayTitle}</span>
      {:else}
        <span class="notification-label">Unread notifications</span>
      {/if}
      <span class="click-indicator">
        <svg 
          class="click-icon" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            stroke-linecap="round" 
            stroke-linejoin="round" 
            stroke-width="2" 
            d="M5 15l7-7 7 7"
          />
        </svg>
      </span>
    </button>
  </div>
{/if}

<style>
  .notification-bell-container {
    position: fixed;
    bottom: 5rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1001;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .stacked-preview {
    position: absolute;
    bottom: 0;
    left: 50%;
    width: calc(100% - 8px);
    pointer-events: none;
    transform: translateX(-50%) translateY(var(--translate-y, 0px));
    opacity: var(--final-opacity, 0.4);
    transition: all 0.3s ease;
  }

  .stacked-preview.animate {
    animation: stackSlideIn 0.6s ease-out forwards;
  }

  @keyframes stackSlideIn {
    0% {
      transform: translateX(-50%) translateY(-12px) scale(0.7);
      opacity: 0;
    }
    50% {
      transform: translateX(-50%) translateY(calc(var(--translate-y, 0px) - 4px)) scale(1.1);
      opacity: calc(var(--final-opacity, 0.4) + 0.3);
    }
    100% {
      transform: translateX(-50%) translateY(var(--translate-y, 0px)) scale(1);
      opacity: var(--final-opacity, 0.4);
    }
  }

  .stacked-preview-border {
    width: 100%;
    height: 4px;
    background: white;
    border: 2px solid rgba(220, 38, 127, 0.2);
    border-top: none;
    border-left: none;
    border-right: none;
    border-radius: 0 0 50px 50px;
  }

  .notification-bell {
    position: relative;
    background: white;
    border: 2px solid rgba(220, 38, 127, 0.4);
    border-radius: 50px;
    padding: 0.75rem 1rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(220, 38, 127, 0.25);
    transition: all 0.3s ease;
    z-index: 1002;
  }

  .notification-bell:hover {
    border-color: rgba(220, 38, 127, 0.6);
    box-shadow: 0 6px 16px rgba(220, 38, 127, 0.35);
    transform: translateY(-2px);
  }

  .notification-bell.wiggle {
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% {
      transform: scale(1);
      box-shadow: 0 4px 12px rgba(220, 38, 127, 0.25);
    }
    50% {
      transform: scale(1.05);
      box-shadow: 0 6px 20px rgba(220, 38, 127, 0.4);
    }
  }

  .bell-icon {
    width: 1.5rem;
    height: 1.5rem;
    color: #dc267f;
    flex-shrink: 0;
  }

  .notification-badge {
    background: linear-gradient(135deg, #dc267f 0%, #b91c73 100%);
    color: white;
    border-radius: 50%;
    width: 1.75rem;
    height: 1.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 700;
    flex-shrink: 0;
    box-shadow: 0 2px 8px rgba(220, 38, 127, 0.4);
  }

  .notification-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: #1a1a4e;
    white-space: nowrap;
  }

  .notification-title-text {
    font-size: 0.875rem;
    font-weight: 600;
    color: #1a1a4e;
    white-space: nowrap;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .click-indicator {
    display: flex;
    align-items: center;
    margin-left: 0.25rem;
    animation: clickPulse 1.5s ease-in-out infinite;
  }

  .click-icon {
    width: 1rem;
    height: 1rem;
    color: #dc267f;
    opacity: 0.7;
  }

  @keyframes clickPulse {
    0%, 100% {
      transform: scale(1);
      opacity: 0.7;
    }
    50% {
      transform: scale(1.2);
      opacity: 1;
    }
  }

  @media (max-width: 768px) {
    .notification-bell-container {
      bottom: 5rem;
    }

    .notification-bell {
      padding: 0.625rem 0.875rem;
    }

    .notification-bell.wiggle {
      animation: pulseMobile 2s ease-in-out infinite;
    }

    @keyframes pulseMobile {
      0%, 100% {
        transform: scale(1);
        box-shadow: 0 4px 12px rgba(220, 38, 127, 0.25);
      }
      50% {
        transform: scale(1.05);
        box-shadow: 0 6px 20px rgba(220, 38, 127, 0.4);
      }
    }

    .notification-label {
      display: none;
    }

    .bell-icon {
      width: 1.25rem;
      height: 1.25rem;
    }

    .notification-badge {
      width: 1.5rem;
      height: 1.5rem;
      font-size: 0.6875rem;
    }

    .click-icon {
      width: 0.875rem;
      height: 0.875rem;
    }
  }
</style>

