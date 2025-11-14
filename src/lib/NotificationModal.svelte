<script lang="ts">
  import { goto } from "$app/navigation";
  import Icon from "@iconify/svelte";
  import NotificationItem from "./NotificationItem.svelte";
  import ImageDisplay from "./components/ImageDisplay.svelte";
  import Modal from "./Modal.svelte";

  let {
    notification,
    onClose,
    onBackdropClose,
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
    onClose: () => void; // Explicit close (close button, action buttons) - marks as read
    onBackdropClose?: () => void; // Backdrop click - just closes, doesn't mark as read
    onMarkRead?: (id: string) => void;
    onNext?: () => void;
    remainingCount?: number;
  }>();

  // Component mapping
  const componentMap = {
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

    // Handle enable_push action (push notification prompt)
    if (action.action === "enable_push") {
      markAsRead();
      onClose();
      
      // Try to enable push directly
      try {
        const { initializePushNotifications } = await import('$lib/push-manager.ts');
        const success = await initializePushNotifications();
        
        if (success) {
          console.log('[Push] Push notifications enabled from notification action');
          // Navigate to /alpha/me to show the updated state
          goto(action.url || "/alpha/me");
        } else {
          console.warn('[Push] Failed to enable push from notification, navigating to settings');
          // If it fails, navigate to settings page where user can try again
          goto(action.url || "/alpha/me");
        }
      } catch (error) {
        console.error('[Push] Error enabling push from notification:', error);
        // Navigate to settings page on error
        goto(action.url || "/alpha/me");
      }
      return;
    }

    // Handle mark_read action (e.g., "Never mind" button)
    if (action.action === "mark_read") {
      markAsRead();
      onClose();
      return;
    }

    // Default: navigate to URL (handle external URLs)
    // Mark as read when clicking navigation links (especially external URLs like Instagram)
    markAsRead();
    onClose();
    if (action.url) {
      // Check if URL is external (starts with http:// or https://)
      if (action.url.startsWith('http://') || action.url.startsWith('https://')) {
        // Open external URL in new tab
        window.open(action.url, '_blank', 'noopener,noreferrer');
      } else {
        // Internal navigation using SvelteKit
        goto(action.url);
      }
    }
  }

  function handleClose() {
    // Explicit close button - mark as read
    markAsRead();
    onClose();
  }

  function handleBackdropClose() {
    // Backdrop click - just close, don't mark as read
    if (onBackdropClose) {
      onBackdropClose();
    } else {
      // Fallback to onClose if onBackdropClose not provided
      onClose();
    }
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

<Modal open={true} onClose={handleClose} onBackdropClick={handleBackdropClose}>
  {#if DisplayComponent()}
    {@const Component = DisplayComponent()}
    {@const props = getComponentProps()}
    {#if Component}
      <div 
        class="display-component-wrapper" 
        onclick={(e) => e.stopPropagation()} 
        onkeydown={(e) => e.stopPropagation()}
        role="presentation"
      >
        {#if notification.displayComponent === "ImageDisplay"}
          <Component imageUrl={props.imageUrl} />
        {/if}
      </div>
    {/if}
  {/if}

  <div 
    class="notification-content-wrapper" 
    onclick={(e) => e.stopPropagation()} 
    onkeydown={(e) => e.stopPropagation()}
    role="dialog" 
    aria-label="Notification"
    tabindex="-1"
  >
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
        {@const isPushPrompt = notification.resourceType === "signup" && notification.resourceId === "pushPrompt"}
        {@const isInstagramFollow = notification.resourceType === "signup" && notification.resourceId === "instagramFollow"}
        {@const isYesButton = (isNewsletterPrompt && action.action === "newsletter_subscribe") || (isPushPrompt && action.action === "enable_push")}
        {@const isNoButton = (isNewsletterPrompt && action.action === "newsletter_decline") || (isPushPrompt && action.action === "mark_read")}
        {@const isInstagramButton = isInstagramFollow && action.action === "navigate" && action.url?.includes("instagram.com")}
        {@const isNeverMindButton = isInstagramFollow && action.action === "mark_read"}
        <button
          class="action-button"
          class:action-button-yes={(isNewsletterPrompt || isPushPrompt) && isYesButton}
          class:action-button-no={(isNewsletterPrompt || isPushPrompt) && isNoButton}
          class:action-button-instagram={isInstagramButton}
          class:action-button-never-mind={isNeverMindButton}
          onclick={() => handleActionClick(action)}
        >
          {#if isInstagramButton}
            <svg class="instagram-icon" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"
              />
            </svg>
          {/if}
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

  /* No button - auto width based on text, outline light primary style */
  .action-button-no {
    flex: 0 0 auto;
    background: transparent;
    color: #1a1a4e;
    border: 2px solid rgba(26, 26, 78, 0.3);
  }

  /* Yes button - spans remaining space with solid secondary style */
  .action-button-yes {
    flex: 1;
    background: var(--color-secondary-500);
    color: var(--color-secondary-100);
    border: 2px solid var(--color-secondary-500);
  }

  .action-button-yes:hover {
    background: transparent;
    color: var(--color-secondary-500);
    border: 2px solid var(--color-secondary-500);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(45, 166, 180, 0.3);
  }

  .action-button-no:hover {
    background: rgba(26, 26, 78, 0.05);
    border-color: rgba(26, 26, 78, 0.5);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(26, 26, 78, 0.15);
  }

  /* Never mind button - auto width based on text */
  .action-button-never-mind {
    flex: 0 0 auto;
  }

  /* Instagram button - spans remaining space with gradient style */
  .action-button-instagram {
    flex: 1;
    background: linear-gradient(
      135deg,
      #f09433 0%,
      #e6683c 25%,
      #dc2743 50%,
      #cc2366 75%,
      #bc1888 100%
    );
    color: white;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    box-shadow: 0 2px 12px rgba(188, 24, 136, 0.3);
  }

  .action-button-instagram:hover {
    background: linear-gradient(
      135deg,
      #f09433 0%,
      #e6683c 25%,
      #dc2743 50%,
      #cc2366 75%,
      #bc1888 100%
    );
    color: white;
    border: none;
    transform: translateY(-2px);
    box-shadow: 0 4px 20px rgba(188, 24, 136, 0.5);
  }

  .action-button-instagram:active {
    background: linear-gradient(
      135deg,
      #f09433 0%,
      #e6683c 25%,
      #dc2743 50%,
      #cc2366 75%,
      #bc1888 100%
    );
    color: white;
    border: none;
    transform: translateY(0);
    box-shadow: 0 2px 12px rgba(188, 24, 136, 0.3);
  }

  .instagram-icon {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
  }

  @media (max-width: 768px) {
    .action-button {
      padding: 0.75rem 1.25rem;
      font-size: 0.875rem;
    }
  }

  .action-button:hover:not(.action-button-instagram) {
    background: rgba(78, 205, 196, 0.1);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(78, 205, 196, 0.2);
  }

  .action-button:active:not(.action-button-instagram) {
    transform: translateY(0);
    box-shadow: 0 2px 6px rgba(78, 205, 196, 0.15);
  }
</style>
