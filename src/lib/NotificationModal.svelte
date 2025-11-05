<script lang="ts">
  import { goto } from "$app/navigation";
  import Icon from "@iconify/svelte";
  import NotificationItem from "./NotificationItem.svelte";
  import PrizePoolDisplay from "./components/PrizePoolDisplay.svelte";
  import VotingProgressDisplay from "./components/VotingProgressDisplay.svelte";
  import OpponentReveal from "./components/OpponentReveal.svelte";
  import VictoryCelebration from "./components/VictoryCelebration.svelte";
  import ImageDisplay from "./components/ImageDisplay.svelte";
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
      imageUrl?: string; // Optional image URL for notifications
    };
    onClose: () => void;
    onMarkRead?: (id: string) => void;
    onNext?: () => void;
    remainingCount?: number;
  }>();

  // Component mapping
  const componentMap = {
    PrizePoolDisplay: PrizePoolDisplay,
    VotingProgressDisplay: VotingProgressDisplay,
    OpponentReveal: OpponentReveal,
    VictoryCelebration: VictoryCelebration,
    ImageDisplay: ImageDisplay,
  };

  const DisplayComponent = $derived(() => {
    if (!notification.displayComponent) return null;
    const component = componentMap[notification.displayComponent] || null;
    console.log("🔍 DisplayComponent check:", {
      displayComponent: notification.displayComponent,
      resourceType: notification.resourceType,
      componentFound: !!component,
      componentMapKeys: Object.keys(componentMap),
    });
    return component;
  });

  // Get component props based on component type
  const getComponentProps = $derived(() => {
    if (
      notification.displayComponent === "PrizePoolDisplay" &&
      notification.resourceType === "identityPurchase"
    ) {
      // For explorer invitations, resourceId format is "identityId|onboarderImageUrl"
      // For regular purchases, resourceId is just the purchaseId
      // Extract the first part (before |) as purchaseId
      const purchaseId = notification.resourceId.includes("|")
        ? notification.resourceId.split("|")[0]
        : notification.resourceId;
      return { purchaseId };
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

    if (
      notification.displayComponent === "OpponentReveal" &&
      notification.resourceType === "opponentReveal"
    ) {
      // Parse matchId and opponentProjectId from resourceId (format: "matchId|opponentProjectId")
      const parts = notification.resourceId.split("|");
      const matchId = parts[0];
      const opponentProjectId = parts[1] || "";
      console.log("🎯 OpponentReveal props:", {
        matchId,
        opponentProjectId,
        resourceId: notification.resourceId,
      });
      return {
        matchId,
        opponentProjectId,
      };
    }

    if (
      notification.displayComponent === "VictoryCelebration" &&
      notification.resourceType === "cupWin"
    ) {
      // Parse cupId and projectId from resourceId (format: "cupId|projectId")
      const parts = notification.resourceId.split("|");
      const cupId = parts[0] || "";
      // The cup name is not in the notification, but VictoryCelebration will fetch it
      return {
        cupId,
        cupName: "", // Will be fetched by the component
      };
    }

    if (
      notification.displayComponent === "ImageDisplay" &&
      notification.imageUrl
    ) {
      // Pass imageUrl to ImageDisplay component
      return {
        imageUrl: notification.imageUrl,
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

  function markAsRead() {
    if (notification.read === "true") return;
    // Just call the callback - parent handles Zero mutation
    onMarkRead?.(notification.id);
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

  async function handleActionClick(action: {
    action?: string;
    url?: string;
    label?: string;
  }) {
    // Handle custom action types
    if (action.action === "renew_subscription") {
      markAsRead();
      try {
        const response = await fetch("/alpha/api/renew-subscription", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            packageType: "hominio",
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Renewal failed");
        }

        // Success - reload page to reflect updated identity state
        window.location.reload();
        return;
      } catch (error) {
        console.error("Renewal failed:", error);
        // On error, navigate to purchase page as fallback
        onClose();
        goto("/alpha/purchase");
        return;
      }
    }

    // Handle newsletter subscription actions
    if (action.action === "newsletter_subscribe" || action.action === "newsletter_decline") {
      markAsRead();
      try {
        // Explicitly set subscription: Yes = true, No = false (not a toggle)
        const shouldSubscribe = action.action === "newsletter_subscribe";
        const response = await fetch("/alpha/api/toggle-newsletter", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            subscribe: shouldSubscribe, // true for Yes, false for No
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to update newsletter preference");
        }

        // Close modal after updating preference
        onClose();
        return;
      } catch (error) {
        console.error("Newsletter preference update failed:", error);
        // Still close modal even on error
        onClose();
        return;
      }
    }

    // Default: navigate to URL
    markAsRead();
    onClose();
    if (action.url) {
      goto(action.url);
    }
  }

  function handleClose() {
    markAsRead();
    onClose();
  }

  const actions = $derived(() => {
    if (!notification.actions) return [];
    try {
      const parsed = JSON.parse(notification.actions);
      // Sort actions by position: left first, then right
      return parsed.sort((a: any, b: any) => {
        const positionOrder = { left: 0, right: 1 };
        const aPos = a.position || 'right';
        const bPos = b.position || 'right';
        return (positionOrder[aPos as keyof typeof positionOrder] || 1) - (positionOrder[bPos as keyof typeof positionOrder] || 1);
      });
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
        {#if notification.displayComponent === "OpponentReveal"}
          <Component
            matchId={props.matchId}
            opponentProjectId={props.opponentProjectId}
          />
        {:else if notification.displayComponent === "VictoryCelebration"}
          <Component cupId={props.cupId} cupName={props.cupName} />
        {:else if notification.displayComponent === "ImageDisplay"}
          <Component imageUrl={props.imageUrl} />
        {:else}
          <Component {...props} />
        {/if}
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
        {@const isNewsletterPrompt = notification.resourceType === "signup" && notification.resourceId === "newsletterPrompt"}
        {@const isYesButton = action.action === "newsletter_subscribe"}
        {@const isNoButton = action.action === "newsletter_decline"}
        <button
          class="action-button"
          class:action-button-yes={isNewsletterPrompt && isYesButton}
          class:action-button-no={isNewsletterPrompt && isNoButton}
          onclick={() => handleActionClick(action)}
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
    min-height: 300px;
    display: flex;
    align-items: center;
    justify-content: center;
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
    flex-direction: row;
    justify-content: space-between;
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
    flex: 1;
    box-shadow: none;
  }

  /* Yes button - solid secondary style */
  .action-button-yes {
    background: #4ecdc4;
    color: #ffffff;
    border: 2px solid #4ecdc4;
  }

  .action-button-yes:hover {
    background: #3fb8b0;
    border-color: #3fb8b0;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(78, 205, 196, 0.3);
  }

  /* No button - outline light primary style */
  .action-button-no {
    background: transparent;
    color: #1a1a4e;
    border: 2px solid rgba(26, 26, 78, 0.3);
  }

  .action-button-no:hover {
    background: rgba(26, 26, 78, 0.05);
    border-color: rgba(26, 26, 78, 0.5);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(26, 26, 78, 0.15);
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
