<script lang="ts">
  import { Zero } from "@rocicorp/zero";
  import { nanoid } from "nanoid";
  import { schema } from "../../zero-schema";
  import { onMount, setContext } from "svelte";
  import { authClient } from "$lib/auth.client.js";
  import { browser } from "$app/environment";
  import { env as publicEnv } from "$env/dynamic/public";
  import { page } from "$app/stores";
  import Navbar from "$lib/Navbar.svelte";
  import ToastContainer from "$lib/ToastContainer.svelte";
  import NotificationModal from "$lib/NotificationModal.svelte";
  import NotificationBell from "$lib/NotificationBell.svelte";

  // Get session data from layout server and children snippet
  let { data, children } = $props<{
    data: any;
    children: import("svelte").Snippet;
  }>();

  const session = authClient.useSession();
  let zero: any = $state(null);
  let zeroReady = $state(false);
  let zeroError: string | null = $state(null);
  let notifications = $state<any[]>([]);
  let notificationModal: any = $state(null);
  let notificationsView: any = null;
  let notificationSound = $state<HTMLAudioElement | null>(null);
  let previousNotificationIds = $state<Set<string>>(new Set());

  // Get Zero server URL from environment (defaults to localhost:4848 for dev)
  const zeroServerUrl = browser
    ? publicEnv.PUBLIC_ZERO_SERVER || "http://localhost:4848"
    : "http://localhost:4848";

  // Initialize Zero once and make it available via context
  onMount(() => {
    if (!browser) return; // Only run on client

    let initZero = async () => {
      try {
        // Wait for session to load (from authClient)
        while ($session.isPending) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        // Use logged-in user ID from authClient session or layout data, or 'anonymous' for public access
        const userId =
          $session.data?.user?.id || data.session?.id || `anon-${nanoid()}`;
        const hasAuth = !!($session.data?.user || data.session);

        // Initialize Zero client (works for both authenticated and anonymous users)
        zero = new Zero({
          server: zeroServerUrl,
          schema,
          userID: userId,
          // Only fetch JWT if user is logged in
          auth: hasAuth
            ? async () => {
                try {
                  const response = await fetch("/alpha/api/zero-auth");
                  if (!response.ok) return null;
                  const { token } = await response.json();
                  return token;
                } catch (error) {
                  console.error("Zero auth error:", error);
                  return null;
                }
              }
            : undefined,
        });

        zeroReady = true;
        zeroError = null;

        // Preload notification sound
        notificationSound = new Audio("/notification.mp3");
        notificationSound.preload = "auto";

        // Load notifications if user is logged in
        if ($session.data?.user || data.session) {
          const userId = $session.data?.user?.id || data.session?.id;
          if (userId && zero) {
            const notificationsQuery = zero.query.notification
              .where("userId", "=", userId)
              .orderBy("createdAt", "desc");
            notificationsView = notificationsQuery.materialize();

            notificationsView.addListener((data) => {
              const newNotifications = Array.from(data);
              // Check for new unread notifications
              const newUnreadNotifications = newNotifications.filter(
                (n) => n.read === "false" && !previousNotificationIds.has(n.id)
              );
              
              // Play notification sound if there are new unread notifications
              if (newUnreadNotifications.length > 0 && notificationSound) {
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
              
              // Update previous notification IDs
              previousNotificationIds = new Set(newNotifications.map((n) => n.id));
              notifications = newNotifications;
            });
          }
        }
      } catch (error) {
        console.error("Failed to initialize Zero:", error);
        zeroError = error instanceof Error ? error.message : "Unknown error";
      }
    };

    initZero();

    return () => {
      // Cleanup Zero on unmount
      if (notificationsView) {
        notificationsView.destroy();
      }
      if (zero) {
        // Zero doesn't have a direct destroy method, but we can close connections
        // The instance will be garbage collected when component unmounts
      }
    };
  });

  // Provide Zero instance and utilities to all child routes via context
  setContext("zero", {
    getInstance: () => zero,
    isReady: () => zeroReady,
    getError: () => zeroError,
    getServerUrl: () => zeroServerUrl,
  });

  // Sign in function - centralized here
  async function signInWithGoogle() {
    await authClient.signIn.social({
      provider: "google",
      callbackURL: "/alpha/me",
    });
  }

  function handleNotificationClose() {
    // Mark the current notification as read before closing
    if (notificationModal) {
      handleNotificationMarkRead(notificationModal.id);
    }
    notificationModal = null;
  }

  async function handleNotificationMarkRead(id: string) {
    // Update local state immediately
    notifications = notifications.map((n) =>
      n.id === id ? { ...n, read: "true" } : n
    );

    // Also update via API to persist
    try {
      await fetch("/alpha/api/notifications/mark-read", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notificationId: id }),
      });
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  }

  // Calculate unread notifications count
  const unreadCount = $derived(
    notifications.filter((n) => n.read === "false").length
  );

  // Get latest unread notification details
  const latestNotification = $derived(() => {
    const unreadNotifications = notifications.filter((n) => n.read === "false");
    if (unreadNotifications.length > 0) {
      // Sort by createdAt descending to get the newest
      const sorted = [...unreadNotifications].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      return sorted[0] || null;
    }
    return null;
  });

  const latestNotificationTitle = $derived(
    latestNotification()?.title?.trim() || ""
  );
  const latestNotificationIcon = $derived(latestNotification()?.icon || "");
  const latestNotificationMessage = $derived(
    latestNotification()?.message?.trim() || ""
  );

  // Function to open notification modal (called by bell click)
  function openNotificationModal() {
    if (unreadCount > 0) {
      // If modal is already open, close it first
      if (notificationModal) {
        notificationModal = null;
        // Open next notification after a brief delay
        setTimeout(() => {
          const unreadNotification = notifications.find(
            (n) => n.read === "false"
          );
          if (unreadNotification) {
            notificationModal = unreadNotification;
          }
        }, 100);
      } else {
        // Open first unread notification
        const unreadNotification = notifications.find(
          (n) => n.read === "false"
        );
        if (unreadNotification) {
          notificationModal = unreadNotification;
        }
      }
    }
  }

  // Function to go to next unread notification
  function goToNextNotification() {
    if (!notificationModal) return;
    
    const unreadNotifications = notifications
      .filter((n) => n.read === "false")
      .sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    
    const currentIndex = unreadNotifications.findIndex(
      (n) => n.id === notificationModal.id
    );
    
    if (currentIndex >= 0 && currentIndex < unreadNotifications.length - 1) {
      // Mark current as read
      handleNotificationMarkRead(notificationModal.id);
      // Open next notification
      notificationModal = unreadNotifications[currentIndex + 1];
    } else {
      // No more notifications, close modal
      handleNotificationMarkRead(notificationModal.id);
      notificationModal = null;
    }
  }

  // Calculate remaining unread notifications count (excluding current)
  const remainingUnreadCount = $derived(() => {
    if (!notificationModal) return 0;
    const unreadNotifications = notifications
      .filter((n) => n.read === "false")
      .sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    const currentIndex = unreadNotifications.findIndex(
      (n) => n.id === notificationModal.id
    );
    if (currentIndex >= 0) {
      return unreadNotifications.length - currentIndex - 1;
    }
    return Math.max(0, unreadNotifications.length - 1);
  });

  // Derived modal open state for navbar - ensure reactivity  
  const isModalOpenState = $derived(!!notificationModal);
  
  // Debug
  $effect(() => {
    console.log("Layout - notificationModal:", notificationModal, "isModalOpenState:", isModalOpenState);
  });

  // Close modal if the current notification is marked as read and show next one
  $effect(() => {
    if (notificationModal) {
      // Check if the current modal notification has been marked as read
      const currentNotification = notifications.find(n => n.id === notificationModal.id);
      if (currentNotification && currentNotification.read === "true") {
        // Close current modal
        notificationModal = null;
        // Show next unread notification if available
        setTimeout(() => {
          const nextUnread = notifications.find((n) => n.read === "false");
          if (nextUnread) {
            notificationModal = nextUnread;
          }
        }, 300);
      }
    }
  });
</script>

{#if $session.data?.user && zeroReady && !notificationModal}
  <NotificationBell 
    unreadCount={unreadCount} 
    onClick={openNotificationModal}
    latestTitle={latestNotificationTitle}
    latestIcon={latestNotificationIcon}
    latestMessage={latestNotificationMessage}
  />
{/if}

<Navbar 
  session={$session} 
  {signInWithGoogle}
  isModalOpen={isModalOpenState}
  onModalClose={handleNotificationClose}
  modalRightButtons={notificationModal && remainingUnreadCount() > 0 ? [{
    label: `Next (${remainingUnreadCount()})`,
    onClick: goToNextNotification,
    ariaLabel: "Next notification"
  }] : []}
/>

<div class="content-wrapper">
  {@render children()}
</div>

<ToastContainer />

{#if notificationModal}
  <NotificationModal
    notification={notificationModal}
    onClose={handleNotificationClose}
    onMarkRead={handleNotificationMarkRead}
    onNext={goToNextNotification}
    remainingCount={remainingUnreadCount()}
  />
{/if}

<style>
  .content-wrapper {
    min-height: 100vh;
  }

  @media (max-width: 768px) {
    .content-wrapper {
      padding-bottom: 60px; /* Space for bottom navbar */
    }
  }
</style>
