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
        // For synced queries, we use cookie-based auth (no JWT needed)
        // Cookies are automatically forwarded by zero-cache when ZERO_GET_QUERIES_FORWARD_COOKIES=true
        zero = new Zero({
          server: zeroServerUrl,
          schema,
          userID: userId,
          // Configure synced queries endpoint (uses cookie-based auth)
          getQueriesURL: browser ? `${window.location.origin}/alpha/api/zero/get-queries` : undefined,
          // For synced queries + custom mutators, we can use opaque tokens or undefined
          // Zero will forward cookies automatically to the server
          // We still provide JWT auth for legacy queries/permissions if needed elsewhere
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
              
              // Update notifications array FIRST so preview bell and derived values work immediately
              notifications = newNotifications;
              
              // Check for new unread notifications
              const newUnreadNotifications = newNotifications.filter(
                (n) => n.read === "false" && !previousNotificationIds.has(n.id)
              );
              
              // Check for priority notifications that should force open
              const priorityNotifications = newUnreadNotifications.filter(
                (n) => n.priority === "true"
              );
              
              // Check for non-priority notifications (for preview bell)
              const nonPriorityNotifications = newUnreadNotifications.filter(
                (n) => n.priority !== "true"
              );
              
              // Handle priority notifications with queue system
              if (priorityNotifications.length > 0) {
                console.log("🔔 Priority notification detected:", priorityNotifications.length, "notifications");
                
                // Sort by createdAt descending (newest first)
                const sortedPriority = priorityNotifications.sort((a, b) => 
                  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                );
                
                // Clean up queue: remove already-read notifications
                priorityNotificationQueue = priorityNotificationQueue.filter(n => {
                  const notification = newNotifications.find(notif => notif.id === n.id);
                  return notification && notification.read === "false";
                });
                
                // Add new priority notifications to queue (avoid duplicates and already-read)
                const currentQueueIds = new Set(priorityNotificationQueue.map(n => n.id));
                const newPriorityNotifications = sortedPriority.filter(n => 
                  !currentQueueIds.has(n.id) && n.read === "false"
                );
                
                if (newPriorityNotifications.length > 0) {
                  // Add to queue, maintaining sort order (newest first)
                  priorityNotificationQueue = [...priorityNotificationQueue, ...newPriorityNotifications]
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                  
                  console.log("🔔 Priority queue updated:", priorityNotificationQueue.length, "notifications in queue");
                }
                
                // Check if we should show a priority notification
                const isCurrentModalPriority = notificationModal && 
                  notifications.find(n => n.id === notificationModal.id)?.priority === "true";
                
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
                    const nextPriorityNotification = priorityNotificationQueue[0];
                    console.log("🔔 Opening priority notification from queue:", nextPriorityNotification.id, nextPriorityNotification.title);
                    notificationModal = nextPriorityNotification;
                  }
                }
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
              previousNotificationIds = new Set(newNotifications.map((n) => n.id));
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
      const isPriority = notifications.find(n => n.id === notificationModal.id)?.priority === "true";
      handleNotificationMarkRead(notificationModal.id);
      
      // If it was a priority notification, remove it from queue
      if (isPriority) {
        priorityNotificationQueue = priorityNotificationQueue.filter(n => n.id !== notificationModal.id);
        console.log("🔔 Removed from priority queue, remaining:", priorityNotificationQueue.length);
      }
      
      notificationModal = null;
      
      // If there are more priority notifications in queue, show the next one
      if (isPriority && priorityNotificationQueue.length > 0) {
        const nextPriorityNotification = priorityNotificationQueue[0];
        console.log("🔔 Opening next priority notification from queue:", nextPriorityNotification.id);
        // Small delay to allow modal close animation
        setTimeout(() => {
          notificationModal = nextPriorityNotification;
        }, 300);
      }
    } else {
      notificationModal = null;
    }
  }

  async function handleNotificationMarkRead(id: string) {
    // Update local state immediately
    notifications = notifications.map((n) =>
      n.id === id ? { ...n, read: "true" } : n
    );
    
    // Remove from priority queue if it's there
    priorityNotificationQueue = priorityNotificationQueue.filter(n => n.id !== id);

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

  async function markAllNonPriorityAsRead() {
    // Update local state immediately - mark all non-priority unread notifications as read
    notifications = notifications.map((n) =>
      n.read === "false" && n.priority !== "true" ? { ...n, read: "true" } : n
    );

    // Also update via API to persist
    try {
      await fetch("/alpha/api/notifications/mark-all-read", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
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
      const sorted = [...unreadNotifications].sort((a, b) => 
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
  const showEditProjectModal = $derived(modalType === "edit-project" && !!modalProjectId);
  const showProjectDetailModal = $derived(modalType === "project-detail" && !!modalProjectId);
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
      const currentNotification = notifications.find(n => n.id === notificationModal.id);
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
      return [{
        label: `Mark all read (${nonPriorityUnreadCount()})`,
        onClick: markAllNonPriorityAsRead,
        ariaLabel: "Mark all non-priority notifications as read"
      }];
    }
    return [];
  });

  // Get modal right buttons - combine notification and project modal buttons
  const modalRightButtons = $derived(() => {
    if (notificationModal && remainingUnreadCount() > 0) {
      return [{
        label: `Next (${remainingUnreadCount()})`,
        onClick: goToNextNotification,
        ariaLabel: "Next notification"
      }];
    }
    
    // Check for project modal buttons
    if (showCreateProjectModal) {
      // Only disable if we have validation state AND it's false
      // If projectActions is null, enable the button (let form validation handle it)
      const canCreate = projectActions ? (projectActions.canCreateProject ?? true) : true;
      return [{
        label: "Create Project",
        onClick: () => {
          const form = document.getElementById("create-project-form") as HTMLFormElement;
          if (form) {
            form.requestSubmit();
          }
        },
        ariaLabel: "Create project",
        disabled: projectActions ? !canCreate : false,
        variant: "primary" as const
      }];
    } else if (showEditProjectModal) {
      // Only disable if we have validation state AND it's false
      // If projectActions is null, enable the button (let form validation handle it)
      const canEdit = projectActions ? (projectActions.canEditProject ?? true) : true;
      const saving = projectActions?.editSaving ?? false;
      return [{
        label: saving ? "Saving..." : "Save Changes",
        onClick: () => {
          const form = document.getElementById("edit-project-form") as HTMLFormElement;
          if (form) {
            form.requestSubmit();
          }
        },
        ariaLabel: "Save project changes",
        disabled: projectActions ? !canEdit : false,
        variant: "primary" as const
      }];
    }
    
    // Check for cup modal buttons
    if (showCreateCupModal) {
      const canCreate = cupActions ? (cupActions.canCreateCup ?? true) : true;
      const creating = cupActions?.creating ?? false;
      return [{
        label: creating ? "Creating..." : "Create Cup",
        onClick: () => {
          const form = document.getElementById("create-cup-form") as HTMLFormElement;
          if (form) {
            form.requestSubmit();
          }
        },
        ariaLabel: "Create cup",
        disabled: cupActions ? !canCreate : false,
        variant: "primary" as const
      }];
    } else if (showEditCupModal) {
      const canEdit = cupActions ? (cupActions.canEditCup ?? true) : true;
      const saving = cupActions?.saving ?? false;
      return [{
        label: saving ? "Saving..." : "Save Changes",
        onClick: () => {
          const form = document.getElementById("edit-cup-form") as HTMLFormElement;
          if (form) {
            form.requestSubmit();
          }
        },
        ariaLabel: "Save cup changes",
        disabled: cupActions ? !canEdit : false,
        variant: "primary" as const
      }];
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
  
  // Debug notification state
  $effect(() => {
    const latest = latestNotification();
    console.log("🔔 Notification State:", {
      notificationModal: notificationModal?.id || null,
      unreadCount,
      latestNotification: latest?.id || null,
      latestNotificationData: latest ? {
        id: latest.id,
        previewTitle: latest.previewTitle,
        title: latest.title,
        previewTitleType: typeof latest.previewTitle,
        titleType: typeof latest.title,
      } : null,
      latestTitle: latestNotificationTitle,
      latestTitleLength: latestNotificationTitle?.length || 0,
      showInviteModal,
      showCreateProjectModal,
      showEditProjectModal,
      showCreateCupModal,
      showEditCupModal,
      shouldShowPreview: !notificationModal && !showInviteModal && !showCreateProjectModal && !showEditProjectModal && !showProjectDetailModal && !showCreateCupModal && !showEditCupModal && unreadCount > 0
    });
  });

  // Close modal if the current notification is marked as read
  // For priority notifications, show next in queue
  $effect(() => {
    if (notificationModal) {
      // Check if the current modal notification has been marked as read
      const currentNotification = notifications.find(n => n.id === notificationModal.id);
      if (currentNotification && currentNotification.read === "true") {
        const isPriority = currentNotification.priority === "true";
        
        // If it was a priority notification, remove it from queue
        if (isPriority) {
          priorityNotificationQueue = priorityNotificationQueue.filter(n => n.id !== notificationModal.id);
          console.log("🔔 Priority notification marked as read, removed from queue, remaining:", priorityNotificationQueue.length);
        }
        
        // Close current modal
        notificationModal = null;
        
        // If there are more priority notifications in queue, show the next one
        if (isPriority && priorityNotificationQueue.length > 0) {
          const nextPriorityNotification = priorityNotificationQueue[0];
          console.log("🔔 Opening next priority notification from queue:", nextPriorityNotification.id);
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
    unreadCount={unreadCount} 
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

{#if showInviteModal && $session.data?.user}
  <Modal open={showInviteModal} onClose={handleModalClose}>
    <InviteOnlyContent />
  </Modal>
{/if}

{#if showProjectDetailModal && modalProjectId}
  <Modal open={showProjectDetailModal} onClose={handleModalClose}>
    <ProjectDetailContent projectId={modalProjectId} onClose={handleModalClose} />
  </Modal>
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
