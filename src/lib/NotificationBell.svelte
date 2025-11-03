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

  const hasUnread = $derived(unreadCount > 0);

  function handleClick() {
    onClick();
  }
</script>

{#if hasUnread}
  <div class="notification-bell-container">
    <!-- Main notification preview -->
    <button
      class="notification-preview"
      onclick={handleClick}
      aria-label={`${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`}
    >
      <div class="preview-content">
        <div class="icon-badge-group">
          <Icon icon="mdi:bell" color="var(--color-accent-500)" class="preview-icon bell-icon" />
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
{/if}

<style>
  .notification-bell-container {
    position: fixed;
    bottom: calc(56px + 0.375rem + 0.5rem); /* Navbar height + margin + gap */
    left: 0;
    right: 0;
    width: 100%;
    z-index: 1001;
    display: flex;
    flex-direction: row;
    align-items: flex-end;
    justify-content: center;
    gap: 0;
    padding: 0;
    margin: 0;
  }

  .notification-preview {
    position: relative;
    background: var(--color-accent-100); /* Accent yellow 100 solid background */
    border: 2px solid var(--color-accent-500); /* Accent yellow border */
    border-radius: 9999px; /* Fully rounded */
    width: fit-content;
    min-width: 280px;
    max-width: 500px;
    height: 48px; /* Slightly smaller than navbar */
    padding: 0 1rem;
    padding-bottom: calc(0 + env(safe-area-inset-bottom));
    display: flex;
    align-items: center;
    cursor: pointer;
    transition: all 0.2s ease-out;
    z-index: 1;
    overflow: visible;
    margin: 0 auto;
    box-shadow: 0 2px 8px rgba(244, 208, 63, 0.15); /* Subtle shadow with accent yellow */
  }

  .notification-preview:hover {
    background: var(--color-accent-500); /* Fill with accent yellow on hover */
    border-color: var(--color-accent-500);
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(244, 208, 63, 0.25);
  }

  .notification-preview:active {
    background: var(--color-accent-600); /* Darker accent yellow on click */
    border-color: var(--color-accent-600);
    transform: translateY(0);
    box-shadow: 0 2px 8px rgba(244, 208, 63, 0.2);
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

  .preview-icon {
    width: 1.25rem;
    height: 1.25rem;
    color: var(--color-accent-500) !important; /* Accent yellow color - force with !important */
    flex-shrink: 0;
    transition: color 0.2s ease-out;
  }

  .notification-preview:hover .preview-icon {
    color: var(--color-accent-100) !important; /* Light accent yellow on hover */
  }

  .preview-icon :global(svg) {
    width: 100%;
    height: 100%;
  }

  .preview-icon :global(svg path) {
    fill: currentColor !important; /* Force paths to use current color */
  }

  .notification-badge {
    background: var(--color-accent-500); /* Accent yellow background */
    color: var(--color-accent-900); /* Dark accent yellow text for contrast */
    border-radius: 9999px; /* Fully rounded pill shape */
    min-width: 1.5rem; /* Smaller width */
    width: auto;
    height: 1.5rem; /* Less fat - smaller height */
    padding: 0 0.5rem; /* Less padding */
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem; /* Smaller font */
    font-weight: 700; /* Slightly less bold */
    line-height: 1;
    flex-shrink: 0;
    position: static;
    margin-left: auto;
    border: none; /* No border */
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
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-accent-700); /* Dark accent yellow for contrast */
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    transition: color 0.2s ease-out;
  }

  .notification-preview:hover .preview-title {
    color: var(--color-accent-100); /* Light accent yellow on hover */
  }

  .chevron-icon {
    width: 1.5rem;
    height: 1.5rem;
    color: var(--color-accent-500); /* Accent yellow */
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s ease-out;
  }

  .notification-preview:hover .chevron-icon {
    color: var(--color-accent-100); /* Light accent yellow on hover */
  }

  .chevron-icon :global(svg) {
    width: 100%;
    height: 100%;
  }

  @media (max-width: 768px) {
    .notification-bell-container {
      bottom: calc(56px + 0.375rem + 0.5rem);
      left: 0;
      right: 0;
      transform: none;
      width: 100%;
      padding: 0;
      margin: 0;
    }

    .notification-preview {
      width: fit-content;
      min-width: 240px;
      max-width: calc(100vw - 2rem);
      height: 44px;
      padding: 0 0.875rem;
      padding-bottom: calc(0 + env(safe-area-inset-bottom));
      border-radius: 9999px;
    }

    .icon-badge-group {
      gap: 0.375rem;
    }

    .notification-badge {
      min-width: 1.375rem; /* Smaller on mobile */
      width: auto;
      height: 1.375rem; /* Less fat */
      font-size: 0.6875rem; /* Smaller font */
      padding: 0 0.4375rem; /* Less padding */
      position: static;
      border-radius: 9999px; /* Fully rounded */
      line-height: 1;
      margin-left: auto;
      border: none; /* No border */
      box-shadow: 0 2px 4px rgba(244, 208, 63, 0.2);
      outline: none;
      background: var(--color-accent-500);
      color: var(--color-accent-900);
    }

    .preview-title {
      font-size: 0.8125rem;
      color: var(--color-accent-700);
    }

    .chevron-icon {
      width: 1.25rem;
      height: 1.25rem;
    }

    .preview-icon {
      width: 1.125rem;
      height: 1.125rem;
    }
  }
</style>
