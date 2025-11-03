<script lang="ts">
  import { Zero } from "@rocicorp/zero";
  import { nanoid } from "nanoid";
  import { schema } from "../../zero-schema";
  import { createMutators } from "$lib/mutators";
  import { myNotifications } from "$lib/synced-queries";
  import { onMount, setContext } from "svelte";
  import { authClient } from "$lib/auth.client.js";
  import { browser } from "$app/environment";
  import { env as publicEnv } from "$env/dynamic/public";
  import { page } from "$app/stores";
  import { getZeroServerUrl, getMainDomainUrl } from "$lib/utils/domain";
  import Navbar from "$lib/Navbar.svelte";
  import ToastContainer from "$lib/ToastContainer.svelte";
  import NotificationModal from "$lib/NotificationModal.svelte";
  import NotificationBell from "$lib/NotificationBell.svelte";
  import Modal from "$lib/Modal.svelte";
  import InviteOnlyContent from "$lib/InviteOnlyContent.svelte";
  import ProjectDetailContent from "$lib/ProjectDetailContent.svelte";
  import { goto } from "$app/navigation";

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
  let priorityNotificationQueue = $state<any[]>([]);
  let markingAsReadIds = $state<Set<string>>(new Set()); // Track notifications being marked as read

  // Get Zero server URL using domain utility
  // Uses hominio.me (DNS-level redirect handles www → non-www)
  // In production: wss://sync.hominio.me
  // In dev: http://localhost:4848
  const zeroServerUrl = browser
    ? (() => {
        // Check if we're in dev (localhost)
        if (
          window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1"
        ) {
          return "http://localhost:4848";
        }
        // Production: use domain utility
        return getZeroServerUrl();
      })()
    : "http://localhost:4848";

  // Initialize Zero once and make it available via context
  onMount(() => {
    if (!browser) return; // Only run on client

    // Add global unhandled rejection handler for debugging
    // This will help us see what mutations are failing
    const unhandledRejectionHandler = (event: PromiseRejectionEvent) => {
      console.error("Unhandled Promise Rejection detected:", event.reason);
      // Log more details if available
      if (event.reason && typeof event.reason === "object") {
        console.error(
          "Rejection details:",
          JSON.stringify(event.reason, null, 2)
        );
      }
      // Don't prevent default - let it log but we've captured it
    };
    window.addEventListener("unhandledrejection", unhandledRejectionHandler);

    let initZero = async () => {
      try {
        // Wait for session to load (from authClient)
        while ($session.isPending) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        // Use logged-in user ID from authClient session or layout data, or 'anonymous' for public access
        const userId =
          $session.data?.user?.id || data.session?.id || `anon-${nanoid()}`;

        // Initialize Zero client (works for both authenticated and anonymous users)
        // For synced queries, we use cookie-based auth (no JWT needed)
        // New Architecture: Cookie-Based Auth Only (No JWT)
        // zero-cache forwards cookies to our server endpoints
        // Server reads BetterAuth session from cookies

        // Debug: Log Zero server URL to help diagnose connection issues (only if URL is invalid)
        // Note: PUBLIC_ZERO_SYNC_DOMAIN may be undefined in dev - domain utility handles this gracefully

        // Validate server URL has proper scheme
        if (
          !zeroServerUrl ||
          (!zeroServerUrl.startsWith("http://") &&
            !zeroServerUrl.startsWith("https://") &&
            !zeroServerUrl.startsWith("ws://") &&
            !zeroServerUrl.startsWith("wss://"))
        ) {
          const error = `Invalid Zero server URL: "${zeroServerUrl}". Must start with http://, https://, ws://, or wss://`;
          console.error("[Zero]", error);
          zeroError = error;
          zeroReady = false;
          return;
        }

        zero = new Zero({
          server: zeroServerUrl,
          schema,
          userID: userId,
          // Register custom mutators for writes (create, update, delete)
          mutators: createMutators(undefined), // AuthData passed to mutators at runtime
          // Configure synced queries endpoint (uses cookie-based auth)
          // Uses domain utility to handle both www and non-www domains
          getQueriesURL: browser
            ? getMainDomainUrl("/alpha/api/zero/get-queries")
            : undefined,
          // Configure custom mutators endpoint (uses cookie-based auth)
          // Uses domain utility to handle both www and non-www domains
          mutateURL: browser
            ? getMainDomainUrl("/alpha/api/zero/push")
            : undefined,
          // ⚠️ NO AUTH FUNCTION - we use cookie-based auth only
          // Cookies are automatically forwarded by zero-cache:
          // - Get-queries: cookies forwarded automatically (no env var needed)
          // - Push/mutators: ZERO_PUSH_FORWARD_COOKIES=true
          // Our server endpoints (get-queries, push) read BetterAuth session from cookies
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
            // Use synced query instead of legacy query
            const notificationsQuery = myNotifications(userId);
            notificationsView = zero.materialize(notificationsQuery);

            notificationsView.addListener((data) => {
              const newNotifications = Array.from(data);

              // Update notifications array - Zero handles optimistic updates automatically
              notifications = newNotifications;

              // Clean up markingAsReadIds: remove IDs that are now confirmed as read by server
              for (const id of markingAsReadIds) {
                const notification = newNotifications.find(
                  (n: any) => n.id === id
                ) as any;
                if (!notification || notification.read === "true") {
                  markingAsReadIds.delete(id);
                }
              }

              // Get ALL unread notifications (not just new ones)
              const allUnreadNotifications = newNotifications.filter(
                (n: any) => n.read === "false"
              );

              // Check for new unread notifications (for sound/alert)
              const newUnreadNotifications = allUnreadNotifications.filter(
                (n: any) => !previousNotificationIds.has(n.id)
              );

              // Get ALL unread priority notifications (for queue management)
              const allUnreadPriorityNotifications =
                allUnreadNotifications.filter(
                  (n: any) =>
                    n.priority === "true" && !markingAsReadIds.has(n.id)
                );

              // Check for new priority notifications (for initial queue addition)
              const newPriorityNotifications = newUnreadNotifications.filter(
                (n: any) => n.priority === "true" && !markingAsReadIds.has(n.id)
              );

              // Check for non-priority notifications (for preview bell)
              const nonPriorityNotifications = newUnreadNotifications.filter(
                (n: any) => n.priority !== "true"
              );

              // Handle priority notifications with queue system
              // Always maintain queue based on ALL unread priority notifications
              if (
                allUnreadPriorityNotifications.length > 0 ||
                priorityNotificationQueue.length > 0
              ) {
                // Sort all unread priority notifications by createdAt descending (newest first)
                const sortedAllPriority = allUnreadPriorityNotifications.sort(
                  (a: any, b: any) =>
                    new Date(b.createdAt).getTime() -
                    new Date(a.createdAt).getTime()
                );

                // Rebuild queue from ALL unread priority notifications (excluding those being marked as read)
                // This ensures queue stays in sync with actual unread priority notifications
                priorityNotificationQueue = sortedAllPriority.filter(
                  (n: any) => !markingAsReadIds.has(n.id)
                );

                // Add any NEW priority notifications that weren't in previous queue
                // (This is mainly for initial notification, but queue is already rebuilt above)
                const currentQueueIds = new Set(
                  priorityNotificationQueue.map((n: any) => n.id)
                );
                const trulyNewPriority = newPriorityNotifications.filter(
                  (n: any) => !currentQueueIds.has(n.id)
                );

                if (trulyNewPriority.length > 0) {
                  // Merge and sort (though queue is already sorted from above)
                  priorityNotificationQueue = [
                    ...priorityNotificationQueue,
                    ...trulyNewPriority,
                  ].sort(
                    (a: any, b: any) =>
                      new Date(b.createdAt).getTime() -
                      new Date(a.createdAt).getTime()
                  );
                }

                // Check if we should show a priority notification
                const isCurrentModalPriority =
                  notificationModal &&
                  notifications.find((n) => n.id === notificationModal.id)
                    ?.priority === "true";

                // Only show priority notification if:
                // 1. No modal is currently open, OR
                // 2. Current modal is not a priority notification
                if (!notificationModal || !isCurrentModalPriority) {
                  if (priorityNotificationQueue.length > 0) {
                    // Close any other modals by clearing URL params
                    const url = new URL(window.location.href);
                    if (url.searchParams.has("modal")) {
                      url.searchParams.delete("modal");
                      url.searchParams.delete("projectId");
                      url.searchParams.delete("cupId");
                      goto(url.pathname + url.search, { replaceState: true });
                    }

                    // Show the first notification in queue
                    const nextPriorityNotification =
                      priorityNotificationQueue[0];
                    notificationModal = nextPriorityNotification;
                  }
                }
              } else {
                // No unread priority notifications, clear the queue
                priorityNotificationQueue = [];
              }
              // For non-priority notifications, they will show in the preview bell
              // Preview bell will show if there are unread notifications and no modal is open

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
              previousNotificationIds = new Set(
                newNotifications.map((n: any) => n.id)
              );
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
      // Remove unhandled rejection handler
      window.removeEventListener(
        "unhandledrejection",
        unhandledRejectionHandler
      );

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
      const notificationId = notificationModal.id;

      // Mark as read (Zero handles optimistic updates)
      handleNotificationMarkRead(notificationId);

      // Close modal - the notification listener will automatically show
      // the next priority notification from the queue if there is one
      notificationModal = null;
    } else {
      notificationModal = null;
    }
  }

  function handleNotificationMarkRead(id: string) {
    // Track that we're marking this notification as read
    // This prevents it from being re-added to priority queue before server confirms
    markingAsReadIds.add(id);

    // Remove from priority queue immediately (UI-only state)
    priorityNotificationQueue = priorityNotificationQueue.filter(
      (n) => n.id !== id
    );

    // Call custom mutator - Zero handles optimistic updates automatically
    if (zero) {
      try {
        // Fire and forget - Zero handles optimistic updates automatically
        // The mutation runs instantly on client, then syncs to server
        // Wrap in Promise.resolve to ensure we can catch any rejection
        const mutation = zero.mutate.notification.markRead({ id });

        // Handle promise rejection properly
        Promise.resolve(mutation).catch((error: any) => {
          console.error("Failed to mark notification as read:", error);
          // Remove from tracking set on error so it can be retried
          markingAsReadIds.delete(id);
        });
      } catch (error) {
        // Handle synchronous errors
        console.error("Failed to call markRead mutator:", error);
        markingAsReadIds.delete(id);
      }
    }
  }

  function markAllNonPriorityAsRead() {
    // Get current user ID
    const userId = $session.data?.user?.id || data.session?.id;
    if (!userId) {
      console.error("Cannot mark notifications as read: no user ID");
      return;
    }

    // Get all unread non-priority notifications
    const unreadNonPriorityNotifications = notifications.filter(
      (n) => n.read === "false" && n.priority !== "true"
    );

    if (unreadNonPriorityNotifications.length === 0) {
      return;
    }

    // Call custom mutator - Zero handles optimistic updates automatically
    if (zero) {
      try {
        // Fire and forget - Zero handles optimistic updates automatically
        // Wrap in Promise.resolve to ensure we can catch any rejection
        const mutation = zero.mutate.notification.markAllRead({ userId });

        // Handle promise rejection properly
        Promise.resolve(mutation).catch((error: any) => {
          console.error("Failed to mark all notifications as read:", error);
        });
      } catch (error) {
        // Handle synchronous errors
        console.error("Failed to call markAllRead mutator:", error);
      }
    }
  }

  // Calculate unread notifications count
  const unreadCount = $derived(
    notifications.filter((n) => n.read === "false").length
  );

  // Get latest unread notification details
  // For preview bell, prefer non-priority notifications (to show preview)
  // Priority notifications will be force-opened and won't show preview
  const latestNotification = $derived(() => {
    const unreadNotifications = notifications.filter((n) => n.read === "false");
    if (unreadNotifications.length > 0) {
      // Sort by createdAt descending to get the newest
      const sorted = [...unreadNotifications].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      // If there's a non-priority notification, prefer it for preview
      // Only show priority notifications in preview if no non-priority ones exist
      // (but priority notifications usually open modals, so this is rare)
      const nonPriority = sorted.find((n) => n.priority !== "true");
      if (nonPriority) {
        return nonPriority;
      }
      // Only return priority notification if no modal is open (shouldn't happen often)
      // If modal is open, don't show preview
      if (!notificationModal) {
        return sorted[0] || null;
      }
      return null;
    }
    return null;
  });

  // Use previewTitle if available, otherwise fall back to title
  const latestNotificationTitle = $derived(() => {
    const latest = latestNotification();
    if (!latest) return "";

    // First try previewTitle
    if (latest.previewTitle && typeof latest.previewTitle === "string") {
      const trimmedPreview = latest.previewTitle.trim();
      if (trimmedPreview) {
        return trimmedPreview;
      }
    }

    // Fall back to title if previewTitle is empty/missing
    if (latest.title && typeof latest.title === "string") {
      const trimmedTitle = latest.title.trim();
      if (trimmedTitle) {
        return trimmedTitle;
      }
    }

    // Only return empty if both are truly empty
    return "";
  });
  const latestNotificationIcon = $derived(latestNotification()?.icon || "");
  const latestNotificationMessage = $derived(() => {
    const latest = latestNotification();
    if (!latest || !latest.message) return "";
    if (typeof latest.message === "string") {
      return latest.message.trim() || "";
    }
    return "";
  });

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

    // Check if current notification is a priority notification
    const currentNotification = notifications.find(
      (n) => n.id === notificationModal.id
    );
    const isPriority = currentNotification?.priority === "true";

    // Mark current notification as read FIRST (before moving to next)
    handleNotificationMarkRead(notificationModal.id);

    if (isPriority) {
      // For priority notifications, use the priority queue
      // Filter out the current notification and those being marked as read
      const availablePriorityNotifications = priorityNotificationQueue.filter(
        (n) => n.id !== notificationModal.id && !markingAsReadIds.has(n.id)
      );

      if (availablePriorityNotifications.length > 0) {
        // Show next priority notification from queue
        notificationModal = availablePriorityNotifications[0];
      } else {
        // No more priority notifications, close modal
        notificationModal = null;
      }
    } else {
      // For non-priority notifications, use general unread list
      const unreadNotifications = notifications
        .filter((n) => n.read === "false" && n.priority !== "true")
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

      const currentIndex = unreadNotifications.findIndex(
        (n) => n.id === notificationModal.id
      );

      if (currentIndex >= 0 && currentIndex < unreadNotifications.length - 1) {
        // Open next non-priority notification
        notificationModal = unreadNotifications[currentIndex + 1];
      } else {
        // No more notifications, close modal
        notificationModal = null;
      }
    }
  }

  // Calculate remaining unread notifications count (excluding current)
  const remainingUnreadCount = $derived(() => {
    if (!notificationModal) return 0;
    const unreadNotifications = notifications
      .filter((n) => n.read === "false")
      .sort(
        (a, b) =>
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

  // Calculate count of non-priority unread notifications
  const nonPriorityUnreadCount = $derived(() => {
    return notifications.filter(
      (n) => n.read === "false" && n.priority !== "true"
    ).length;
  });

  // Generic modal system: detect modal param from URL search params
  const modalType = $derived($page.url.searchParams.get("modal"));
  const modalProjectId = $derived($page.url.searchParams.get("projectId"));
  const modalCupId = $derived($page.url.searchParams.get("cupId"));
  const showInviteModal = $derived(modalType === "invite");
  const showCreateProjectModal = $derived(modalType === "create-project");
  const showEditProjectModal = $derived(
    modalType === "edit-project" && !!modalProjectId
  );
  const showProjectDetailModal = $derived(
    modalType === "project-detail" && !!modalProjectId
  );
  const showCreateCupModal = $derived(modalType === "create-cup");
  const showEditCupModal = $derived(modalType === "edit-cup" && !!modalCupId);

  // Ensure only one modal can be open at a time
  // If notification modal is open, close URL-based modals
  $effect(() => {
    if (notificationModal && modalType) {
      const url = new URL($page.url);
      url.searchParams.delete("modal");
      url.searchParams.delete("projectId");
      url.searchParams.delete("cupId");
      goto(url.pathname + url.search, { replaceState: true });
    }
  });

  // If URL-based modal is opened, close notification modal
  // BUT: Don't close if it's a priority notification (they should stay open)
  $effect(() => {
    if (modalType && notificationModal) {
      // Check if current notification is priority - if so, don't close it
      const currentNotification = notifications.find(
        (n) => n.id === notificationModal.id
      );
      if (currentNotification && currentNotification.priority === "true") {
        // Priority notification should stay open, close URL modal instead
        const url = new URL($page.url);
        url.searchParams.delete("modal");
        url.searchParams.delete("projectId");
        url.searchParams.delete("cupId");
        goto(url.pathname + url.search, { replaceState: true });
      } else {
        // Non-priority notification, close it when URL modal opens
        notificationModal = null;
      }
    }
  });

  // Reactive state to track project modal actions
  let projectActions = $state<any>(null);

  // Reactive state to track cup modal actions
  let cupActions = $state<any>(null);

  // Watch for project modal actions updates
  $effect(() => {
    if (browser && (showCreateProjectModal || showEditProjectModal)) {
      // Check immediately and then periodically for updates
      const checkActions = () => {
        const actions = (window as any).__projectModalActions;
        if (actions) {
          // Only update if values actually changed to trigger reactivity
          const newActions = {
            handleCreateSubmit: actions.handleCreateSubmit,
            handleEditSubmit: actions.handleEditSubmit,
            canCreateProject: actions.canCreateProject,
            canEditProject: actions.canEditProject,
            editSaving: actions.editSaving,
            showCreateModal: actions.showCreateModal,
            showEditModal: actions.showEditModal,
          };
          projectActions = newActions;
        }
      };

      checkActions(); // Check immediately
      const interval = setInterval(checkActions, 100);

      return () => clearInterval(interval);
    } else {
      projectActions = null;
    }
  });

  // Watch for cup modal actions updates
  $effect(() => {
    if (browser && (showCreateCupModal || showEditCupModal)) {
      // Check immediately and then periodically for updates
      const checkActions = () => {
        const actions = (window as any).__cupModalActions;
        if (actions) {
          const newActions = {
            handleCreateSubmit: actions.handleCreateSubmit,
            handleEditSubmit: actions.handleEditSubmit,
            canCreateCup: actions.canCreateCup,
            canEditCup: actions.canEditCup,
            creating: actions.creating,
            saving: actions.saving,
          };
          cupActions = newActions;
        }
      };

      checkActions(); // Check immediately
      const interval = setInterval(checkActions, 100);

      return () => clearInterval(interval);
    } else {
      cupActions = null;
    }
  });

  // Get modal left buttons - for notification modal
  const modalLeftButtons = $derived(() => {
    if (notificationModal && nonPriorityUnreadCount() > 0) {
      return [
        {
          label: `Mark all read (${nonPriorityUnreadCount()})`,
          onClick: markAllNonPriorityAsRead,
          ariaLabel: "Mark all non-priority notifications as read",
        },
      ];
    }
    return [];
  });

  // Get modal right buttons - combine notification and project modal buttons
  const modalRightButtons = $derived(() => {
    if (notificationModal && remainingUnreadCount() > 0) {
      return [
        {
          label: `Next (${remainingUnreadCount()})`,
          onClick: goToNextNotification,
          ariaLabel: "Next notification",
        },
      ];
    }

    // Check for project modal buttons
    if (showCreateProjectModal) {
      // Only disable if we have validation state AND it's false
      // If projectActions is null, enable the button (let form validation handle it)
      const canCreate = projectActions
        ? (projectActions.canCreateProject ?? true)
        : true;
      return [
        {
          label: "Create Project",
          onClick: () => {
            const form = document.getElementById(
              "create-project-form"
            ) as HTMLFormElement;
            if (form) {
              form.requestSubmit();
            }
          },
          ariaLabel: "Create project",
          disabled: projectActions ? !canCreate : false,
          variant: "primary" as const,
        },
      ];
    } else if (showEditProjectModal) {
      // Only disable if we have validation state AND it's false
      // If projectActions is null, enable the button (let form validation handle it)
      const canEdit = projectActions
        ? (projectActions.canEditProject ?? true)
        : true;
      const saving = projectActions?.editSaving ?? false;
      return [
        {
          label: saving ? "Saving..." : "Save Changes",
          onClick: () => {
            const form = document.getElementById(
              "edit-project-form"
            ) as HTMLFormElement;
            if (form) {
              form.requestSubmit();
            }
          },
          ariaLabel: "Save project changes",
          disabled: projectActions ? !canEdit : false,
          variant: "primary" as const,
        },
      ];
    }

    // Check for cup modal buttons
    if (showCreateCupModal) {
      const canCreate = cupActions ? (cupActions.canCreateCup ?? true) : true;
      const creating = cupActions?.creating ?? false;
      return [
        {
          label: creating ? "Creating..." : "Create Cup",
          onClick: () => {
            const form = document.getElementById(
              "create-cup-form"
            ) as HTMLFormElement;
            if (form) {
              form.requestSubmit();
            }
          },
          ariaLabel: "Create cup",
          disabled: cupActions ? !canCreate : false,
          variant: "primary" as const,
        },
      ];
    } else if (showEditCupModal) {
      const canEdit = cupActions ? (cupActions.canEditCup ?? true) : true;
      const saving = cupActions?.saving ?? false;
      return [
        {
          label: saving ? "Saving..." : "Save Changes",
          onClick: () => {
            const form = document.getElementById(
              "edit-cup-form"
            ) as HTMLFormElement;
            if (form) {
              form.requestSubmit();
            }
          },
          ariaLabel: "Save cup changes",
          disabled: cupActions ? !canEdit : false,
          variant: "primary" as const,
        },
      ];
    }

    return [];
  });

  // Derived modal open state for navbar - ensure reactivity
  const isModalOpenState = $derived(!!notificationModal || !!modalType);

  function handleModalClose() {
    // Stay on the same route, just remove the modal param
    const url = new URL($page.url);
    url.searchParams.delete("modal");
    url.searchParams.delete("projectId");
    url.searchParams.delete("cupId");
    goto(url.pathname + url.search, { replaceState: true });
  }

  // Close modal if the current notification is marked as read
  // For priority notifications, show next in queue
  $effect(() => {
    if (notificationModal) {
      // Check if the current modal notification has been marked as read
      const currentNotification = notifications.find(
        (n) => n.id === notificationModal.id
      );
      if (currentNotification && currentNotification.read === "true") {
        const isPriority = currentNotification.priority === "true";

        // If it was a priority notification, remove it from queue
        if (isPriority) {
          priorityNotificationQueue = priorityNotificationQueue.filter(
            (n) => n.id !== notificationModal.id
          );
        }

        // Close current modal
        notificationModal = null;

        // If there are more priority notifications in queue, show the next one
        if (isPriority && priorityNotificationQueue.length > 0) {
          const nextPriorityNotification = priorityNotificationQueue[0];
          // Small delay to allow modal close animation
          setTimeout(() => {
            notificationModal = nextPriorityNotification;
          }, 300);
        }
      }
    }
  });
</script>

{#if $session.data?.user && zeroReady && !notificationModal && !showInviteModal && !showCreateProjectModal && !showEditProjectModal && !showProjectDetailModal && !showCreateCupModal && !showEditCupModal && unreadCount > 0}
  <NotificationBell
    {unreadCount}
    onClick={openNotificationModal}
    latestTitle={latestNotificationTitle()}
    latestIcon={latestNotificationIcon()}
    latestMessage={latestNotificationMessage()}
  />
{/if}

<Navbar
  session={$session}
  {signInWithGoogle}
  isModalOpen={isModalOpenState}
  onModalClose={modalType ? handleModalClose : handleNotificationClose}
  modalLeftButtons={modalLeftButtons()}
  modalRightButtons={modalRightButtons()}
/>

<!-- Background -->
<div class="fixed inset-0 w-full h-full -z-10 bg-brand-cream-50"></div>

<!-- Bottom glassmorphic effect behind navbar (inverted) -->
<div
  class="fixed bottom-0 left-0 right-0 z-[9999] pointer-events-none"
  style="height: 80px; background: linear-gradient(to bottom, transparent 0%, rgba(250, 249, 246, 0.75) 50%, rgba(250, 249, 246, 1) 100%); backdrop-filter: blur(28px) saturate(200%); -webkit-backdrop-filter: blur(28px) saturate(200%); mask-image: linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.75) 50%, black 100%); -webkit-mask-image: linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.75) 50%, black 100%); border-top: 1px solid rgba(255, 255, 255, 0.2); box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.12), inset 0 -1px 0 rgba(255, 255, 255, 0.2);"
></div>

<div class="content-wrapper relative min-h-screen">
  <div class="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
    {@render children()}
    <!-- Spacer to ensure content can scroll properly behind navbar -->
    <div class="h-20"></div>
  </div>
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

{#if showInviteModal && $session.data?.user}
  <Modal open={showInviteModal} onClose={handleModalClose}>
    <InviteOnlyContent />
  </Modal>
{/if}

{#if showProjectDetailModal && modalProjectId}
  <Modal open={showProjectDetailModal} onClose={handleModalClose}>
    <ProjectDetailContent
      projectId={modalProjectId}
      onClose={handleModalClose}
    />
  </Modal>
{/if}

<style>
  .content-wrapper {
    min-height: 100vh;
  }

  @media (max-width: 768px) {
    .content-wrapper {
      padding-bottom: 20px; /* Space for bottom navbar */
    }
  }
</style>
