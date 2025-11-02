<script lang="ts">
  import { goto } from "$app/navigation";
  import Icon from "@iconify/svelte";
  import NotificationItem from "./NotificationItem.svelte";
  import PrizePoolDisplay from "./components/PrizePoolDisplay.svelte";
  import VotingProgressDisplay from "./components/VotingProgressDisplay.svelte";

  let { notification, onClose, onMarkRead, onNext, remainingCount = 0 } = $props<{
    notification: {
      id: string;
      title: string;
      message: string;
      read: string;
      createdAt: string;
      resourceType: string;
      resourceId: string;
      actions?: string; // JSON string array
      sound?: string; // Optional sound file path
      icon?: string; // Optional Iconify icon name (e.g., "mdi:bell", "material-symbols:notifications")
      displayComponent?: string; // Optional component name to display above header
    };
    onClose: () => void;
    onMarkRead?: (id: string) => void;
    onNext?: () => void;
    remainingCount?: number;
  }>();

  // Component mapping
  const componentMap: Record<string, any> = {
    PrizePoolDisplay: PrizePoolDisplay,
    VotingProgressDisplay: VotingProgressDisplay,
  };

  const DisplayComponent = $derived(() => {
    if (!notification.displayComponent) return null;
    return componentMap[notification.displayComponent] || null;
  });

  // Get component props based on component type
  const getComponentProps = $derived(() => {
    if (notification.displayComponent === "PrizePoolDisplay" && notification.resourceType === "identityPurchase") {
      return { purchaseId: notification.resourceId };
    }
    
    if (notification.displayComponent === "VotingProgressDisplay" && notification.resourceType === "vote") {
      // Parse matchId and projectSide from resourceId (format: "matchId|projectSide")
      const parts = notification.resourceId.split("|");
      const matchId = parts[0];
      const projectSide = (parts[1] === "project1" || parts[1] === "project2") ? parts[1] : "project1";
      return { matchId, projectSide };
    }
    
    return {};
  });

  // Play sound for each notification when it's displayed
  $effect(() => {
    // Determine which sound to play
    let soundPath = notification.sound;
    
    // If no custom sound, use purchase sound for identity purchase notifications
    if (!soundPath && notification.resourceType === "identityPurchase") {
      soundPath = "/purchase-effect.mp3";
    }
    
    // If still no sound, use default notification sound
    if (!soundPath) {
      soundPath = "/notification.mp3";
    }

    // Only play sound for unread notifications
    if (notification.read === "false" && soundPath) {
      const notificationSound = new Audio(soundPath);
      notificationSound.preload = "auto";
      
      try {
        notificationSound.currentTime = 0;
        const playPromise = notificationSound.play();
        if (playPromise !== undefined) {
          playPromise.catch((error) => {
            console.warn("Could not play notification sound:", error);
          });
        }
      } catch (error) {
        console.warn("Could not play notification sound:", error);
      }
    }
  });

  async function markAsRead() {
    if (notification.read === "true") return;
    
    try {
      const response = await fetch("/alpha/api/notifications/mark-read", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notificationId: notification.id }),
      });

      if (response.ok) {
        onMarkRead?.(notification.id);
      }
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      markAsRead();
      onClose();
    }
  }

  function handleMarkRead(id: string) {
    onMarkRead?.(id);
  }

  function handleActionClick(url: string) {
    markAsRead();
    onClose();
    goto(url);
  }

  function handleClose() {
    markAsRead();
    onClose();
  }

  const actions = $derived(() => {
    if (!notification.actions) return [];
    try {
      return JSON.parse(notification.actions);
    } catch {
      return [];
    }
  });
</script>

<div class="modal-backdrop" onclick={handleBackdropClick}>
  <div class="modal-content" onclick={(e) => e.stopPropagation()}>
    {#if DisplayComponent()}
      <div class="display-component-wrapper">
        <svelte:component this={DisplayComponent()} {...getComponentProps()} />
      </div>
    {/if}
    
    <NotificationItem {notification} onMarkRead={handleMarkRead} showActions={false} />
    
    {#if actions().length > 0}
      <div class="actions-container">
        {#each actions() as action}
          <button
            class="action-button"
            onclick={() => handleActionClick(action.url)}
          >
            {action.label}
          </button>
        {/each}
      </div>
    {/if}

    <div class="bottom-actions">
      <button class="close-button" onclick={handleClose} aria-label="Close">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="close-icon">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      {#if remainingCount > 0 && onNext}
        <button class="next-button" onclick={onNext} aria-label="Next notification">
          Next ({remainingCount})
        </button>
      {/if}
    </div>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    z-index: 1003;
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
    max-height: 85vh;
    overflow-y: auto;
    position: relative;
    animation: slideUp 0.3s ease-out;
    box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.15);
    display: flex;
    flex-direction: column;
    align-items: center;
    /* Prevent iOS scroll gap */
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
  }

  @media (max-width: 768px) {
    .modal-content {
      padding: 1.75rem 1.5rem;
      padding-bottom: 0;
      max-height: 90vh;
    }
  }

  .display-component-wrapper {
    width: 100%;
    margin-bottom: 1.5rem;
  }

  @keyframes slideUp {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }

  .actions-container {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid rgba(78, 205, 196, 0.2);
  }

  @media (max-width: 768px) {
    .actions-container {
      margin-top: 1rem;
      padding-top: 1rem;
      gap: 0.5rem;
    }
  }

  .action-button {
    background: #1a1a4e;
    color: white;
    padding: 1rem 1.75rem;
    border-radius: 16px;
    border: none;
    font-weight: 600;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.2s;
    width: 100%;
    box-shadow: 0 2px 8px rgba(26, 26, 78, 0.15);
  }

  @media (max-width: 768px) {
    .action-button {
      padding: 0.875rem 1.5rem;
      font-size: 0.9375rem;
    }
  }

  .action-button:hover {
    background: #4ecdc4;
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(78, 205, 196, 0.3);
  }

  .action-button:active {
    transform: translateY(0);
    box-shadow: 0 2px 8px rgba(26, 26, 78, 0.15);
  }

  .bottom-actions {
    position: sticky;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 1rem 2rem;
    padding-bottom: calc(1rem + env(safe-area-inset-bottom));
    background: white;
    border-top: 1px solid rgba(26, 26, 78, 0.08);
    margin-top: auto;
    z-index: 10;
  }

  .bottom-actions.has-next {
    justify-content: space-between;
  }

  @media (max-width: 768px) {
    .bottom-actions {
      padding: 0.875rem 1.5rem;
      padding-bottom: calc(0.875rem + env(safe-area-inset-bottom));
      gap: 0.75rem;
    }
  }

  .close-button {
    background: rgba(26, 26, 78, 0.1);
    border: 2px solid rgba(26, 26, 78, 0.2);
    border-radius: 50%;
    width: 3rem;
    height: 3rem;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
  }

  .close-button:hover {
    background: rgba(26, 26, 78, 0.15);
    border-color: rgba(26, 26, 78, 0.3);
    transform: scale(1.05);
  }

  .next-button {
    background: rgba(26, 26, 78, 0.1);
    border: 2px solid rgba(26, 26, 78, 0.2);
    border-radius: 20px;
    padding: 0.625rem 1.25rem;
    cursor: pointer;
    transition: all 0.2s;
    font-weight: 600;
    font-size: 0.875rem;
    white-space: nowrap;
    flex-shrink: 0;
    color: #1a1a4e;
    margin-left: auto;
  }

  .next-button:hover {
    background: rgba(26, 26, 78, 0.15);
    border-color: rgba(26, 26, 78, 0.3);
    transform: scale(1.02);
  }

  .next-button:active {
    transform: scale(1);
  }

  .close-icon {
    width: 1.25rem;
    height: 1.25rem;
    color: #1a1a4e;
  }
</style>
