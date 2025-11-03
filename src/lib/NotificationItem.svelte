<script lang="ts">
  import { goto } from "$app/navigation";
  import Icon from "@iconify/svelte";

  let { notification, onMarkRead, showActions = true } = $props<{
    notification: {
      id: string;
      title: string;
      message: string;
      read: string;
      createdAt: string;
      resourceType: string;
      resourceId: string;
      actions?: string; // JSON string array
      icon?: string; // Optional Iconify icon name (e.g., "mdi:bell", "material-symbols:notifications")
    };
    onMarkRead?: (id: string) => void;
    showActions?: boolean;
  }>();

  const isRead = $derived(notification.read === "true");
  const createdAt = $derived(new Date(notification.createdAt));

  function formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return `${diffInSeconds} sec ago`;
    }
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes} min ago`;
    }
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours} h ago`;
    }
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} d ago`;
  }

  const relativeTime = $derived(formatRelativeTime(createdAt));

  function handleMarkRead() {
    if (isRead) return;
    // Just call the callback - parent handles Zero mutation
    onMarkRead?.(notification.id);
  }

  function handleActionClick(url: string, event: MouseEvent) {
    event.stopPropagation();
    goto(url);
  }

  const actions = $derived(() => {
    if (!notification.actions || !showActions) return [];
    try {
      return JSON.parse(notification.actions);
    } catch {
      return [];
    }
  });
</script>

<div class="notification-item" class:read={isRead} class:modal-mode={!showActions} onclick={handleMarkRead}>
  <div class="notification-content">
    {#if notification.icon && !showActions}
      <div class="notification-icon-above" class:thumb-down={notification.icon === "mdi:thumb-down"}>
        <Icon icon={notification.icon} />
      </div>
    {/if}
    <div class="title-row">
      <h3 class="notification-title">{notification.title}</h3>
    </div>
    <p class="notification-message">{notification.message}</p>
    <time class="notification-time" datetime={notification.createdAt}>
      {relativeTime}
    </time>
    
    {#if actions().length > 0 && showActions}
      <div class="actions-container">
        {#each actions() as action}
          <button
            class="action-button"
            onclick={(e) => handleActionClick(action.url, e)}
          >
            {action.label}
          </button>
        {/each}
      </div>
    {/if}
  </div>
  {#if !isRead && showActions}
    <div class="unread-indicator"></div>
  {/if}
</div>

<style>
  .notification-item {
    background: white;
    border: 2px solid rgba(78, 205, 196, 0.3);
    border-radius: 12px;
    padding: 1.5rem;
    margin-bottom: 1rem;
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: 1rem;
  }

  .notification-item.modal-mode {
    border: none;
    padding: 0;
    margin-bottom: 0;
    cursor: default;
  }

  .notification-item:hover:not(.modal-mode) {
    border-color: #4ecdc4;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(78, 205, 196, 0.15);
  }

  .notification-item.read {
    opacity: 0.7;
    border-color: rgba(26, 26, 78, 0.1);
  }

  .notification-content {
    flex: 1;
    width: 100%;
  }

  .title-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }

  .notification-item.modal-mode .title-row {
    margin-bottom: 1rem;
  }

  .notification-icon-above {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    margin-bottom: 1rem;
    color: #4ecdc4;
  }

  .notification-icon-above.thumb-down {
    color: #f87171;
  }

  .notification-icon-above :global(svg) {
    width: 3rem;
    height: 3rem;
  }

  .notification-title {
    color: #1a1a4e;
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
    line-height: 1.3;
    flex: 1;
  }

  .notification-item.modal-mode .notification-title {
    font-size: 1.75rem;
  }

  .notification-message {
    color: rgba(26, 26, 78, 0.7);
    font-size: 1rem;
    margin: 0 0 1rem 0;
    line-height: 1.6;
  }

  .notification-item.modal-mode .notification-message {
    font-size: 1.125rem;
    margin-bottom: 1.25rem;
  }

  .notification-time {
    color: rgba(26, 26, 78, 0.5);
    font-size: 0.875rem;
  }

  .notification-item.modal-mode .notification-time {
    font-size: 0.9375rem;
  }

  .actions-container {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-top: 1rem;
  }

  .action-button {
    background: linear-gradient(135deg, #4ecdc4 0%, #1a1a4e 100%);
    color: white;
    padding: 0.75rem 1.5rem;
    border-radius: 10px;
    border: none;
    font-weight: 600;
    font-size: 0.9375rem;
    cursor: pointer;
    transition: all 0.2s;
    width: 100%;
    text-align: center;
  }

  .action-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(78, 205, 196, 0.3);
  }

  .action-button:active {
    transform: translateY(0);
  }

  .unread-indicator {
    width: 10px;
    height: 10px;
    background: #4ecdc4;
    border-radius: 50%;
    flex-shrink: 0;
    margin-top: 0.25rem;
  }
</style>
