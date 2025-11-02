<script lang="ts">
  import { goto } from "$app/navigation";
  import Icon from "@iconify/svelte";
  import NotificationItem from "./NotificationItem.svelte";
  import PrizePoolDisplay from "./components/PrizePoolDisplay.svelte";
  import VotingProgressDisplay from "./components/VotingProgressDisplay.svelte";
  import Modal from "./Modal.svelte";

  let {
    notification,
    onClose,
    onMarkRead,
    onNext,
    remainingCount = 0,
  } = $props<{
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
    if (
      notification.displayComponent === "PrizePoolDisplay" &&
      notification.resourceType === "identityPurchase"
    ) {
      return { purchaseId: notification.resourceId };
    }

    if (
      notification.displayComponent === "VotingProgressDisplay" &&
      notification.resourceType === "vote"
    ) {
      // Parse matchId, projectSide, and votesReceived from resourceId (format: "matchId|projectSide|votesReceived")
      const parts = notification.resourceId.split("|");
      const matchId = parts[0];
      const projectSide =
        parts[1] === "project1" || parts[1] === "project2"
          ? parts[1]
          : "project1";
      const votesReceived = parts[2] ? parseInt(parts[2], 10) : 0;
      return {
        matchId,
        projectSide,
        votesReceived,
        notificationIcon: notification.icon,
      };
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

<Modal open={true} {onClose}>
  {#if DisplayComponent()}
    {@const Component = DisplayComponent()}
    {@const props = getComponentProps()}
    {#if Component}
      <div class="display-component-wrapper">
        <Component {...props} />
      </div>
    {/if}
  {/if}

  <div class="notification-content-wrapper">
    <NotificationItem
      {notification}
      onMarkRead={handleMarkRead}
      showActions={false}
    />
  </div>

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
</Modal>

<style>
  .display-component-wrapper {
    width: 100%;
    margin-bottom: 1.5rem;
    padding: 0;
  }

  .notification-content-wrapper {
    width: 100%;
    padding: 0;
  }

  .notification-content-wrapper
    :global(.notification-item.modal-mode .title-row) {
    justify-content: center;
  }

  .notification-content-wrapper
    :global(.notification-item.modal-mode .notification-title) {
    text-align: center;
    flex: 0 1 auto;
  }

  .notification-content-wrapper
    :global(.notification-item.modal-mode .notification-message) {
    text-align: center;
  }

  .notification-content-wrapper
    :global(.notification-item.modal-mode .notification-time) {
    text-align: center;
    display: block;
  }

  .actions-container {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    padding-bottom: 1rem;
    border-top: 1px solid rgba(78, 205, 196, 0.2);
  }

  @media (max-width: 768px) {
    .actions-container {
      margin-top: 1rem;
      padding-top: 1rem;
      padding-bottom: 1rem;
      gap: 0.5rem;
    }
  }

  .action-button {
    background: transparent;
    color: #4ecdc4;
    padding: 0.875rem 1.5rem;
    border-radius: 999px;
    border: 2px solid #4ecdc4;
    font-weight: 600;
    font-size: 0.9375rem;
    cursor: pointer;
    transition: all 0.2s;
    width: auto;
    box-shadow: none;
  }

  @media (max-width: 768px) {
    .action-button {
      padding: 0.75rem 1.25rem;
      font-size: 0.875rem;
    }
  }

  .action-button:hover {
    background: rgba(78, 205, 196, 0.1);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(78, 205, 196, 0.2);
  }

  .action-button:active {
    transform: translateY(0);
    box-shadow: 0 2px 6px rgba(78, 205, 196, 0.15);
  }
</style>
