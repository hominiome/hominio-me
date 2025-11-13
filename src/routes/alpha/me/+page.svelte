<script lang="ts">
  import { authClient } from "$lib/auth.client.js";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import { useZero } from "$lib/zero-utils";
  import QRCodeDisplay from "$lib/QRCodeDisplay.svelte";
  import Modal from "$lib/Modal.svelte";
  import { page } from "$app/stores";
  import {
    purchasesByUser,
    identitiesByUser,
    userPreferencesByUser,
    pushSubscriptionsByUser,
  } from "$lib/synced-queries";

  // Session data from layout
  let { data } = $props();

  // Get the public profile URL
  let profileUrl = $derived(
    browser && data.session?.id
      ? `${window.location.origin}/alpha/user/${data.session.id}`
      : ""
  );

  // Get the invite link for admin onboarding
  const inviteLink = $derived(
    browser && data.session?.id
      ? `${window.location.origin}/alpha/invite/${data.session.id}`
      : ""
  );

  let copied = $state(false);

  async function copyToClipboard() {
    if (!inviteLink) return;
    
    try {
      await navigator.clipboard.writeText(inviteLink);
      copied = true;
      setTimeout(() => {
        copied = false;
      }, 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  }

  // Check if user has explorer identity
  const hasExplorerIdentity = $derived(() => {
    return userIdentities.some((id: any) => id.identityType === "explorer");
  });

  const zeroContext = useZero();
  const session = authClient.useSession();

  let signingOut = $state(false);
  let imageFailed = $state(false);
  let samuelImageFailed = $state(false);
  // Samuel's profile image
  let samuelImageUrl = $state<string | null>("/hominiono1.jpg");
  let zero = $state<any>(null);
  let userIdentities = $state<any[]>([]);
  let purchases = $state<any[]>([]);
  let userPreferences = $state<any[]>([]);
  let pushSubscriptions = $state<any[]>([]);
  let loading = $state(true);

  async function handleSignOut() {
    signingOut = true;
    await authClient.signOut();
    goto("/alpha");
  }

  let canceling = $state(false);
  let cancelError = $state("");
  let cancelSuccess = $state("");
  let cancelPackageType = $state<string | null>(null);

  // Detect end subscription modal from URL
  const showCancelModal = $derived(
    $page.url.searchParams.get("modal") === "cancel-subscription"
  );
  const modalPackageType = $derived(
    $page.url.searchParams.get("packageType") || null
  );

  // Set end subscription actions for layout to pick up
  $effect(() => {
    if (browser && showCancelModal && modalPackageType) {
      (window as any).__cancelSubscriptionActions = {
        handleCancel: handleCancelModalClose,
        handleConfirm: confirmCancelSubscription,
      };
    } else {
      delete (window as any).__cancelSubscriptionActions;
    }
  });

  function requestCancelSubscription(packageType: string) {
    const url = new URL($page.url);
    url.searchParams.set("modal", "cancel-subscription");
    url.searchParams.set("packageType", packageType);
    goto(url.pathname + url.search, { replaceState: false });
  }

  function handleCancelModalClose() {
    const url = new URL($page.url);
    url.searchParams.delete("modal");
    url.searchParams.delete("packageType");
    goto(url.pathname + url.search, { replaceState: true });
  }

  async function confirmCancelSubscription() {
    if (!modalPackageType || canceling) return;

    canceling = true;
    cancelError = "";
    cancelSuccess = "";

    try {
      const response = await fetch("/alpha/api/cancel-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          packageType: modalPackageType,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Cancel failed");
      }

      cancelSuccess =
        "Subscription ended successfully. Access will continue until the end of your billing period.";
      handleCancelModalClose();
      // Reload page to reflect updated identity state
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error("Cancel failed:", error);
      cancelError =
        error instanceof Error
          ? error.message
          : "Cancel failed. Please try again.";
      setTimeout(() => {
        cancelError = "";
      }, 5000);
    } finally {
      canceling = false;
    }
  }

  function getIdentityLabel(identityType: string) {
    switch (identityType) {
      case "explorer":
        return "Explorer";
      case "hominio":
        return "I am Hominio";
      case "founder":
        return "Hominio Founder";
      case "angel":
        return "Hominio Angel";
      default:
        return identityType;
    }
  }

  // Calculate countdown for expiring identities
  function getExpirationCountdown(
    expiresAt: string | null | undefined
  ): string | null {
    if (!expiresAt) return null;

    const expirationDate = new Date(expiresAt);
    const now = new Date();
    const diff = expirationDate.getTime() - now.getTime();

    if (diff <= 0) return "Expired";

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    if (days > 0) {
      return `${days}d ${hours}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  // Reactive countdown state - updates every second for identities with expiration
  let countdowns = $state<Record<string, string | null>>({});

  $effect(() => {
    if (!browser) return;

    // Update countdowns for all identities with expiration dates
    const newCountdowns: Record<string, string | null> = {};
    for (const identity of userIdentities) {
      if (identity.expiresAt) {
        newCountdowns[identity.id] = getExpirationCountdown(identity.expiresAt);
      }
    }
    countdowns = newCountdowns;

    // Set up interval to update countdowns every second
    const interval = setInterval(() => {
      const updatedCountdowns: Record<string, string | null> = {};
      for (const identity of userIdentities) {
        if (identity.expiresAt) {
          updatedCountdowns[identity.id] = getExpirationCountdown(
            identity.expiresAt
          );
        }
      }
      countdowns = updatedCountdowns;
    }, 1000);

    return () => clearInterval(interval);
  });



  onMount(() => {
    let identitiesView: any;
    let purchasesView: any;
    let preferencesView: any;
    let subscriptionsView: any;

    (async () => {
      // Wait for Zero to be ready
      while (!zeroContext.isReady() || !zeroContext.getInstance()) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      zero = zeroContext.getInstance();

      const userId = $session.data?.user?.id;
      if (!userId) {
        loading = false;
        return;
      }

      // Trigger lazy expiration cleanup when viewing profile
      try {
        await fetch("/alpha/api/check-identity-expiry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });
      } catch (error) {
        console.warn("Failed to check identity expiry:", error);
      }

      // Create push prompt notification if user hasn't enabled push yet
      // This will show as a priority notification with modal trigger
      try {
        await fetch("/alpha/api/create-push-prompt", {
          method: "POST",
        });
      } catch (error) {
        console.warn("Failed to create push prompt:", error);
      }

      // Query user's identities using synced query
      const identitiesQuery = identitiesByUser(userId);
      identitiesView = zero.materialize(identitiesQuery);

      identitiesView.addListener((data: any) => {
        userIdentities = Array.from(data || []);
      });

      // Query user's purchases using synced query
      const purchasesQuery = purchasesByUser(userId);
      purchasesView = zero.materialize(purchasesQuery);

      purchasesView.addListener((data: any) => {
        // Already sorted by purchasedAt desc from synced query
        purchases = Array.from(data || []);
      });

      // Query user preferences using synced query
      const preferencesQuery = userPreferencesByUser(userId);
      preferencesView = zero.materialize(preferencesQuery);

      preferencesView.addListener((data: any) => {
        userPreferences = Array.from(data || []);
        
        // Sync browser permission with server state after preferences are loaded
        if (data && Array.from(data).length > 0) {
          syncPushPermissionWithServer();
        }
      });

      // Query push subscriptions using synced query
      const subscriptionsQuery = pushSubscriptionsByUser(userId);
      subscriptionsView = zero.materialize(subscriptionsQuery);

      subscriptionsView.addListener((data: any) => {
        pushSubscriptions = Array.from(data || []);
        loading = false;
      });
    })();

    return () => {
      if (identitiesView) identitiesView.destroy();
      if (purchasesView) purchasesView.destroy();
      if (preferencesView) preferencesView.destroy();
      if (subscriptionsView) subscriptionsView.destroy();
    };
  });

  // Get current user preferences (defaults to not subscribed: false)
  const currentPreferences = $derived(() => {
    return userPreferences.length > 0 ? userPreferences[0] : null;
  });

  const isNewsletterSubscribed = $derived(() => {
    if (!currentPreferences()) {
      return false; // Default to not subscribed
    }
    return currentPreferences()?.newsletterSubscribed === 'true';
  });

  // Check if push is enabled on any device
  const isPushEnabled = $derived(() => {
    // Push is enabled if user has at least one active subscription
    return pushSubscriptions.length > 0;
  });

  // Get current device endpoint (for comparison)
  let currentDeviceEndpoint = $state<string | null>(null);
  
  $effect(() => {
    if (!browser || !('serviceWorker' in navigator)) return;
    
    (async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        currentDeviceEndpoint = subscription?.endpoint || null;
      } catch {
        currentDeviceEndpoint = null;
      }
    })();
  });

  // Toggle newsletter subscription
  async function toggleNewsletterSubscription() {
    if (!zero || !data.session?.id) return;

    const userId = data.session.id;
    const currentPrefs = currentPreferences();
    const newSubscriptionStatus = isNewsletterSubscribed() ? 'false' : 'true';

    if (currentPrefs) {
      // Update existing preferences
      zero.mutate.userPreferences.update({
        id: currentPrefs.id,
        newsletterSubscribed: newSubscriptionStatus,
        updatedAt: new Date().toISOString(),
      });
    } else {
      // Create new preferences (defaults to subscribed, but user is toggling)
      const { nanoid } = await import('nanoid');
      zero.mutate.userPreferences.create({
        id: nanoid(),
        userId: userId,
        newsletterSubscribed: newSubscriptionStatus,
        pushEnabled: 'false',
        updatedAt: new Date().toISOString(),
      });
    }
  }

  // Check if current device has push enabled
  const isCurrentDevicePushEnabled = $derived(() => {
    if (!currentDeviceEndpoint) return false;
    return pushSubscriptions.some((sub: any) => sub.endpoint === currentDeviceEndpoint);
  });

  // Toggle push notifications
  // If no devices have push: enable on current device
  // If at least one device has push: toggle current device
  async function togglePushNotifications() {
    if (!zero || !data.session?.id) return;

    const userId = data.session.id;
    const hasAnyPush = isPushEnabled();
    const currentDeviceHasPush = isCurrentDevicePushEnabled();

    // If enabling push (no devices have push OR current device doesn't have push)
    if (!hasAnyPush || !currentDeviceHasPush) {
      const { initializePushNotifications } = await import('$lib/push-manager.ts');
      const success = await initializePushNotifications();
      
      if (!success) {
        console.log('[Push] Failed to enable push notifications on this device');
        return;
      }
      // If subscription succeeded, the /alpha/api/push/subscribe endpoint
      // will automatically create/update the subscription
      // pushEnabled will be updated automatically based on subscriptions count
    } else {
      // If disabling push, unsubscribe only this device
      const { unsubscribeFromPush } = await import('$lib/push-manager.ts');
      await unsubscribeFromPush();
      // The /alpha/api/push/unsubscribe endpoint will automatically
      // remove this device's subscription and update pushEnabled if no subscriptions remain
    }
  }

  // Remove push subscription for a specific device
  async function removeDeviceSubscription(endpoint: string) {
    if (!zero || !data.session?.id) return;

    try {
      const { unsubscribeFromPush } = await import('$lib/push-manager.ts');
      
      // If it's the current device, use the standard unsubscribe
      if (endpoint === currentDeviceEndpoint) {
        await unsubscribeFromPush();
      } else {
        // Otherwise, call the API directly to remove the subscription
        await fetch('/alpha/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        });
      }
    } catch (error) {
      console.error('[Push] Failed to remove device subscription:', error);
    }
  }

  // Sync browser permission with server state on mount
  let syncInProgress = false;
  async function syncPushPermissionWithServer() {
    if (!browser || !('Notification' in window) || !data.session?.id) return;
    
    // Prevent concurrent sync calls
    if (syncInProgress) {
      console.log('[Push] Sync already in progress, skipping');
      return;
    }
    
    syncInProgress = true;
    
    try {
      const permission = Notification.permission;
      const currentPrefs = currentPreferences();
      
      if (!currentPrefs) {
        console.log('[Push] No preferences found, skipping sync');
        return;
      }

      console.log('[Push] Syncing permission:', {
        permission,
        pushEnabled: currentPrefs.pushEnabled,
        subscriptionsCount: pushSubscriptions.length,
        preferencesId: currentPrefs.id,
        preferencesUserId: currentPrefs.userId,
        sessionUserId: data.session?.id,
      });

      // Get current device subscription
      let currentSubscription: PushSubscription | null = null;
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.ready;
          currentSubscription = await registration.pushManager.getSubscription();
        } catch (error) {
          console.error('[Push] Error getting current subscription:', error);
        }
      }

      // Clean up: Remove database subscriptions that don't exist in browser
      // This handles cases where browser subscriptions were cleared but DB still has them
      if (currentSubscription) {
        const currentEndpoint = currentSubscription.endpoint;
        // Check if current subscription exists in database
        const existsInDb = pushSubscriptions.some((sub: any) => sub.endpoint === currentEndpoint);
        if (!existsInDb) {
          console.log('[Push] Current subscription not in DB, saving it');
          // Save current subscription to server
          const subscriptionData = {
            endpoint: currentSubscription.endpoint,
            keys: {
              p256dh: arrayBufferToBase64(currentSubscription.getKey('p256dh')!),
              auth: arrayBufferToBase64(currentSubscription.getKey('auth')!),
            },
          };
          await fetch('/alpha/api/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscription: subscriptionData }),
          });
        }
      } else {
        // No current subscription - remove all DB subscriptions for this user
        // This handles cases where browser cleared subscriptions but DB still has them
        if (pushSubscriptions.length > 0) {
          console.log('[Push] No browser subscription but DB has subscriptions - cleaning up');
          // Remove all subscriptions from DB
          for (const sub of pushSubscriptions) {
            await fetch('/alpha/api/push/unsubscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ endpoint: sub.endpoint }),
            });
          }
        }
      }

      // If browser permission is denied but server says enabled, disable on server
      if (permission === 'denied') {
        if (pushSubscriptions.length > 0) {
          console.log('[Push] Browser permission denied - removing all subscriptions');
          // Remove all subscriptions
          for (const sub of pushSubscriptions) {
            await fetch('/alpha/api/push/unsubscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ endpoint: sub.endpoint }),
            });
          }
        }
        if (currentPrefs.pushEnabled === 'true' && zero && currentPrefs.userId === data.session?.id) {
          zero.mutate.userPreferences.update({
            id: currentPrefs.id,
            pushEnabled: 'false',
            updatedAt: new Date().toISOString(),
          });
        }
        return;
      }

      // If browser permission is granted but server says disabled, check subscription
      if (permission === 'granted') {
        if (currentSubscription) {
          // Check if subscription exists in database
          const existsInDb = pushSubscriptions.some((sub: any) => sub.endpoint === currentSubscription!.endpoint);
          if (!existsInDb) {
            console.log('[Push] Browser has subscription but not in DB - saving it');
            // Save subscription to server
            const subscriptionData = {
              endpoint: currentSubscription.endpoint,
              keys: {
                p256dh: arrayBufferToBase64(currentSubscription.getKey('p256dh')!),
                auth: arrayBufferToBase64(currentSubscription.getKey('auth')!),
              },
            };
            await fetch('/alpha/api/push/subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ subscription: subscriptionData }),
            });
          }
        } else {
          // Permission is granted but no subscription exists
          // Don't automatically try to create - user might have denied it intentionally
          // Only log for debugging
          console.log('[Push] Permission granted but no subscription exists');
          console.log('[Push] User can enable push manually via toggle');
        }
      }
    } finally {
      syncInProgress = false;
    }
  }

  // Helper to convert ArrayBuffer to base64
  function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }
</script>

<div class="profile-container">
  <div class="profile-card">
    <div class="profile-header">
      {#if hasExplorerIdentity()}
        <div class="avatar">
          {#if data.session?.image && !imageFailed}
            <img
              src={data.session.image}
              alt={data.session.name}
              onerror={() => (imageFailed = true)}
            />
          {:else}
            <div class="avatar-placeholder">
              {data.session?.name?.charAt(0).toUpperCase() || "U"}
            </div>
          {/if}
        </div>
        <h1 class="profile-name">{data.session?.name || "User"}</h1>
        <p class="profile-email">{data.session?.email}</p>
        <p class="profile-id">{data.session?.id || "—"}</p>
      {/if}

      {#if !hasExplorerIdentity() && profileUrl}
        <!-- Invite section - shown when no explorer identity -->
        <div class="invite-section">
          <h2 class="invite-title">Invite Only</h2>
          
          <div class="qr-section">
            <QRCodeDisplay data={profileUrl} />
            
            {#if inviteLink}
              <div class="link-section">
                <div class="link-container">
                  <input 
                    type="text" 
                    value={inviteLink} 
                    readonly 
                    class="link-input"
                    onclick={(e) => e.currentTarget.select()}
                  />
                  <button 
                    onclick={copyToClipboard}
                    class="copy-button"
                    aria-label="Copy link to clipboard"
                  >
                    {copied ? "Copied!" : "Copy Link"}
                  </button>
                </div>
              </div>
            {/if}

            <p class="qr-instruction">Get early adopter access</p>
            
                    <div class="info-section">
                      <p class="info-text">
                        Have any questions or requests? Feel free to contact me anytime.
                      </p>
                    </div>

                    <div class="samuel-profile-section">
                      <div class="samuel-avatar-container">
                        {#if samuelImageUrl && !samuelImageFailed}
                          <img 
                            src={samuelImageUrl} 
                            alt="Samuel" 
                            class="samuel-avatar"
                            onerror={() => samuelImageFailed = true}
                          />
                        {:else}
                          <div class="samuel-avatar-placeholder">
                            <span>S</span>
                          </div>
                        {/if}
                      </div>
                      <p class="cta-message">
                        I am Samuel, HominioNo1<br>
                        and I am looking forward to chat with you.
                      </p>
                    </div>

            <a
              href="https://instagram.com/samuelandert"
              target="_blank"
              rel="noopener noreferrer"
              class="instagram-button"
            >
              <svg class="instagram-icon" viewBox="0 0 24 24" fill="currentColor">
                <path
                  d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"
                />
              </svg>
              <span>Message Me</span>
            </a>
          </div>
        </div>
      {:else if hasExplorerIdentity()}
        <!-- Feedback button - shown when explorer identity exists -->
        <a
          href="https://instagram.com/samuelandert"
          target="_blank"
          rel="noopener noreferrer"
          class="instagram-button"
        >
          <svg class="instagram-icon" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"
            />
          </svg>
          <span>Any Request? Message Me!</span>
        </a>
      {/if}
    </div>


    <div class="profile-section">
      <h2 class="section-title">Notification Preferences</h2>
      <div class="preferences-list">
        <div class="preference-item">
          <div class="preference-info">
            <span class="preference-label">Newsletter Notifications</span>
            <span class="preference-description">
              Receive important updates and announcements
            </span>
          </div>
          <button
            class="toggle-switch"
            class:active={isNewsletterSubscribed()}
            onclick={toggleNewsletterSubscription}
            aria-label={isNewsletterSubscribed() ? "Disable newsletter notifications" : "Enable newsletter notifications"}
          >
            <span class="toggle-slider"></span>
          </button>
        </div>
        <div class="preference-item">
          <div class="preference-info">
            <span class="preference-label">Push Notifications</span>
            <span class="preference-description">
              Receive priority notifications even when browser is closed
            </span>
            {#if pushSubscriptions.length > 0}
              <div class="devices-list">
                <span class="devices-label">Active on {pushSubscriptions.length} device{pushSubscriptions.length === 1 ? '' : 's'}:</span>
                {#each pushSubscriptions as subscription}
                  <div class="device-item">
                    <span class="device-name">{subscription.deviceName || 'Unknown Device'}</span>
                    {#if subscription.endpoint === currentDeviceEndpoint}
                      <span class="device-badge current">This Device</span>
                    {/if}
                    <button
                      class="device-remove"
                      onclick={() => removeDeviceSubscription(subscription.endpoint)}
                      aria-label={`Remove push notifications from ${subscription.deviceName || 'device'}`}
                    >
                      ×
                    </button>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
          <button
            class="toggle-switch"
            class:active={isPushEnabled()}
            onclick={togglePushNotifications}
            aria-label={isPushEnabled() ? "Disable push notifications" : "Enable push notifications"}
          >
            <span class="toggle-slider"></span>
          </button>
        </div>
      </div>
    </div>

    <div class="divider-line"></div>

    <div class="sign-out-container">
      <button
        onclick={handleSignOut}
        disabled={signingOut}
        class="btn-sign-out"
      >
        <svg
          class="sign-out-icon"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
          />
        </svg>
        {signingOut ? "Signing out..." : "Sign Out"}
      </button>
    </div>

    {#if hasExplorerIdentity()}
      <div class="divider-line"></div>
    {/if}

    {#if loading}
      <div class="profile-section">
        <p class="loading-text">Loading...</p>
      </div>
    {:else}
      {#if cancelError}
        <div class="profile-section">
          <div
            class="bg-red/10 border-2 border-red text-red px-6 py-4 rounded-xl text-center font-medium"
          >
            {cancelError}
          </div>
        </div>
      {/if}
      {#if cancelSuccess}
        <div class="profile-section">
          <div
            class="bg-green/10 border-2 border-green text-green px-6 py-4 rounded-xl text-center font-medium"
          >
            {cancelSuccess}
          </div>
        </div>
      {/if}
      {#if hasExplorerIdentity()}
        <div class="profile-section">
          <h2 class="section-title">My Active Identities</h2>
        {#if userIdentities.length === 0}
          <div class="empty-state">
            <p>You don't have any active voting identities yet.</p>
            <p class="empty-state-note">Use the invite section above to get onboarded as an explorer.</p>
          </div>
        {:else}
          <div class="identities-list">
            {#each userIdentities as identity}
              {@const hasSubscription =
                identity.identityType === "hominio" && identity.subscriptionId}
              {@const isCanceled =
                identity.expiresAt && new Date(identity.expiresAt) > new Date()}
              <div class="identity-item">
                <div class="identity-main">
                  <div class="identity-hearts">
                    <svg
                      class="heart-icon-large"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path
                        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                      />
                    </svg>
                  </div>
                  <div class="identity-info">
                    <span class="identity-name">
                      {getIdentityLabel(identity.identityType)}
                    </span>
                    {#if identity.identityType === "hominio" && hasSubscription}
                      <span class="identity-subscription text-xs text-[rgba(26,26,78,0.6)] mt-1">
                        14$/year. excl. VAT
                      </span>
                    {/if}
                  </div>
                </div>
                {#if identity.expiresAt}
                  <div class="mt-2 flex items-center gap-2">
                    <span
                      class="inline-flex items-center px-4 py-1 rounded-full text-xs font-semibold bg-alert-100 text-alert-800 border border-alert-200 whitespace-nowrap"
                    >
                      {countdowns[identity.id] || "Calculating..."}
                    </span>
                    {#if hasSubscription && isCanceled}
                      <button
                        onclick={() =>
                          requestCancelSubscription(identity.identityType)}
                        disabled={canceling}
                        class="px-4 py-2 text-xs font-semibold text-white bg-alert-500 rounded-lg hover:bg-alert-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        End Subscription
                      </button>
                    {/if}
                  </div>
                {:else if identity.upgradedFrom}
                  <div class="identity-upgrade">
                    Upgraded from {getIdentityLabel(identity.upgradedFrom)}
                  </div>
                {/if}
                {#if hasSubscription && !identity.expiresAt}
                  <div class="mt-2">
                    <button
                      onclick={() =>
                        requestCancelSubscription(identity.identityType)}
                      disabled={canceling}
                      class="px-4 py-2 text-xs font-semibold text-white bg-alert-500 rounded-lg hover:bg-alert-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      Cancel Subscription
                    </button>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
        </div>


        <div class="profile-section">
          <h2 class="section-title">Purchase History</h2>
        {#if purchases.length === 0}
          <div class="empty-state">
            <p>No purchase history yet.</p>
          </div>
        {:else}
          <div class="purchases-list">
            {#each purchases as purchase}
              <div class="purchase-item">
                <div class="purchase-main">
                  <div class="purchase-info">
                    <span class="purchase-identity">
                      {getIdentityLabel(purchase.identityType)}
                    </span>
                    <span class="purchase-date">
                      {new Date(purchase.purchasedAt).toLocaleDateString(
                        "en-US",
                        {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )}
                    </span>
                  </div>
                  <div class="purchase-price">
                    €{(purchase.price / 100).toFixed(2)}
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
        </div>
      {/if}
    {/if}
  </div>
</div>

<!-- Cancel Subscription Confirmation Modal -->
{#if showCancelModal && modalPackageType}
  <Modal
    open={showCancelModal}
    onClose={handleCancelModalClose}
    variant="danger"
  >
    <div class="w-full">
      <h2 class="text-3xl font-bold text-alert-100 mb-4">
        End Subscription
      </h2>
      <p class="text-alert-100/90 mb-4 text-base leading-relaxed">
        Are you sure you want to end your subscription? Your voting access
        will continue until the end of your current billing period.
      </p>
    </div>
  </Modal>
{/if}

<style>
  .profile-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    overflow-x: hidden;
  }

  .profile-card {
    width: 100%;
    max-width: 750px;
    background: white;
    border-radius: 24px;
    box-shadow:
      0 8px 32px rgba(79, 195, 195, 0.15),
      0 2px 8px rgba(0, 0, 0, 0.05);
    padding: 3rem;
    border: 2px solid #4fc3c3;
    box-sizing: border-box;
    overflow-x: hidden;
  }

  .profile-header {
    text-align: center;
    margin-bottom: 3rem;
    padding-bottom: 2rem;
    border-bottom: 2px solid #e5e7eb;
  }

  .avatar {
    width: 120px;
    height: 120px;
    margin: 0 auto 1.5rem;
    border-radius: 50%;
    overflow: hidden;
    border: 4px solid #4fc3c3;
  }

  .avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .avatar-placeholder {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #4fc3c3 0%, #3da8a8 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 3rem;
    font-weight: 900;
    color: white;
  }

  .profile-name {
    font-size: 2rem;
    font-weight: 800;
    color: #111827;
    margin: 0 0 0.5rem 0;
    letter-spacing: -0.02em;
  }

  .profile-email {
    font-size: 1.125rem;
    color: #6b7280;
    margin: 0 0 0.25rem 0;
  }

  .profile-id {
    font-size: 0.75rem;
    color: #9ca3af;
    margin: 0 0 1.5rem 0;
    font-family: monospace;
  }

  .invite-section {
    margin: 1.5rem 0;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    padding: 1.5rem;
    background: rgba(240, 255, 254, 0.3);
    border: 2px solid rgba(78, 205, 196, 0.2);
    border-radius: 12px;
  }

  .invite-title {
    font-size: 1.75rem;
    font-weight: 700;
    color: #1a1a4e;
    margin: 0;
    text-align: center;
  }

  .qr-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    width: 100%;
  }

  .qr-instruction {
    font-size: 0.875rem;
    color: rgba(26, 26, 78, 0.8);
    text-align: center;
    margin: 0;
    font-weight: 500;
  }

  .instagram-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.875rem 1.5rem;
    margin: 0.5rem 0 1.5rem 0;
    background: linear-gradient(
      135deg,
      #f09433 0%,
      #e6683c 25%,
      #dc2743 50%,
      #cc2366 75%,
      #bc1888 100%
    );
    color: white;
    text-decoration: none;
    border-radius: 50px;
    font-size: 0.875rem;
    font-weight: 600;
    transition: all 0.3s;
    box-shadow: 0 2px 12px rgba(188, 24, 136, 0.3);
  }

  .instagram-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 20px rgba(188, 24, 136, 0.5);
  }

  .instagram-button:active {
    transform: translateY(0);
  }


  .instagram-icon {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
  }

  .link-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    max-width: 500px;
  }


  .info-section {
    width: 100%;
  }

  .info-text {
    font-size: 0.875rem;
    color: rgba(26, 26, 78, 0.7);
    line-height: 1.5;
    margin: 0;
    text-align: center;
  }

  .samuel-profile-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    margin: 1rem 0 0.25rem 0;
  }

  .samuel-avatar-container {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .samuel-avatar {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid rgba(78, 205, 196, 0.3);
  }

  .samuel-avatar-placeholder {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: linear-gradient(135deg, #4ecdc4 0%, #1a1a4e 100%);
    border: 2px solid rgba(78, 205, 196, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 700;
    font-size: 1.75rem;
  }

  .cta-message {
    font-size: 0.875rem;
    color: rgba(26, 26, 78, 0.7);
    line-height: 1.5;
    margin: 0;
    text-align: center;
  }

  @media (max-width: 768px) {
    .samuel-profile-section {
      margin: 0.75rem 0 0.25rem 0;
      gap: 0.5rem;
    }

    .samuel-avatar,
    .samuel-avatar-placeholder {
      width: 64px;
      height: 64px;
    }

    .samuel-avatar-placeholder {
      font-size: 1.5rem;
    }

    .cta-message {
      margin: 0;
    }
  }

  .qr-section :global(.qr-container) {
    background: transparent;
    padding: 1rem;
    border-radius: 8px;
  }



  .link-container {
    display: flex;
    gap: 0.5rem;
    width: 100%;
    align-items: center;
  }

  .link-input {
    flex: 1;
    padding: 0.625rem 0.875rem;
    border: 2px solid rgba(78, 205, 196, 0.3);
    border-radius: 8px;
    background: white;
    color: #1a1a4e;
    font-size: 0.875rem;
    font-family: monospace;
    cursor: text;
    min-width: 0;
    max-width: 100%;
    box-sizing: border-box;
  }

  .link-input:focus {
    outline: none;
    border-color: #4ecdc4;
    box-shadow: 0 0 0 3px rgba(78, 205, 196, 0.1);
  }

  .copy-button {
    padding: 0.625rem 1.25rem;
    background: #4ecdc4;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .copy-button:hover {
    background: #3db5ac;
    transform: translateY(-1px);
  }

  .copy-button:active {
    transform: translateY(0);
  }

  @media (max-width: 768px) {
    .invite-section {
      padding: 1rem;
      gap: 1.25rem;
    }

    .invite-title {
      font-size: 1.5rem;
    }

    .instagram-button {
      padding: 0.625rem 1.25rem;
      font-size: 0.813rem;
    }

    .instagram-icon {
      width: 16px;
      height: 16px;
    }

    .link-container {
      flex-direction: column;
      max-width: 100%;
      overflow-x: hidden;
    }

    .link-input {
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
    }

    .copy-button {
      width: 100%;
      box-sizing: border-box;
    }
  }


  .profile-section {
    margin-bottom: 2rem;
  }

  /* .section-title removed - using global h2 styles from app.css */


  .divider-line {
    width: 100%;
    height: 1px;
    background: rgba(78, 205, 196, 0.2);
    margin: 1.5rem 0;
  }

  .sign-out-container {
    margin-top: 1rem;
    margin-bottom: 0;
  }

  .btn-sign-out {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    background: #a3376a;
    color: white;
    border: 2px solid #a3376a;
    border-radius: 12px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    width: 100%;
    justify-content: center;
  }

  .btn-sign-out:hover:not(:disabled) {
    background: #8d2d59;
    border-color: #8d2d59;
  }

  .btn-sign-out:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .sign-out-icon {
    width: 16px;
    height: 16px;
  }

  /* Unused button styles removed */

  .loading-text {
    color: #6b7280;
    text-align: center;
    padding: 2rem 0;
  }

  .empty-state {
    padding: 2rem;
    text-align: center;
    color: #6b7280;
  }


  .identities-list,
  .purchases-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .identity-item,
  .purchase-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.875rem 1rem;
    background: #f9fafb;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
  }


  .identity-main {
    display: flex;
    align-items: center;
    gap: 1rem;
    width: 100%;
  }

  .identity-hearts {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    flex-shrink: 0;
    position: relative;
    background: #fef3c7;
    border-radius: 8px;
  }

  .heart-icon-large {
    width: 48px;
    height: 48px;
    color: #f4d03f;
    flex-shrink: 0;
  }

  .identity-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex: 1;
    min-width: 0;
    align-items: flex-start;
  }

  .purchase-main {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }

  .identity-info,
  .purchase-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex: 1;
  }


  .identity-name {
    font-size: 0.9375rem;
    font-weight: 600;
    color: #111827;
  }

  .purchase-identity {
    color: #111827;
  }


  .identity-upgrade {
    margin-top: 0.5rem;
    font-size: 0.75rem;
    color: #9ca3af;
    font-style: italic;
  }

  .purchase-date {
    font-size: 0.75rem;
    color: #9ca3af;
    margin-top: 0.25rem;
  }

  .purchase-price {
    font-size: 1.125rem;
    font-weight: 700;
    color: #f4d03f;
    white-space: nowrap;
  }

  .preferences-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .preference-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    background: rgba(240, 255, 254, 0.5);
    border: 2px solid rgba(78, 205, 196, 0.2);
    border-radius: 12px;
    transition: all 0.2s;
  }

  .preference-item:hover {
    border-color: rgba(78, 205, 196, 0.4);
    background: rgba(240, 255, 254, 0.7);
  }

  .preference-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex: 1;
  }

  .preference-label {
    font-size: 1rem;
    font-weight: 600;
    color: #1a1a4e;
  }

  .preference-description {
    font-size: 0.875rem;
    color: rgba(26, 26, 78, 0.6);
  }

  .devices-list {
    margin-top: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .devices-label {
    font-size: 0.75rem;
    color: rgba(26, 26, 78, 0.5);
    font-weight: 500;
  }

  .device-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: rgba(78, 205, 196, 0.1);
    border-radius: 6px;
    border: 1px solid rgba(78, 205, 196, 0.2);
  }

  .device-name {
    font-size: 0.813rem;
    color: rgba(26, 26, 78, 0.8);
    flex: 1;
  }

  .device-badge {
    font-size: 0.688rem;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-weight: 600;
  }

  .device-badge.current {
    background: rgba(78, 205, 196, 0.2);
    color: #1a1a4e;
  }

  .device-remove {
    background: transparent;
    border: none;
    color: rgba(26, 26, 78, 0.5);
    font-size: 1.25rem;
    line-height: 1;
    cursor: pointer;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
  }

  .device-remove:hover {
    background: rgba(163, 55, 106, 0.1);
    color: #a3376a;
  }

  .toggle-switch {
    position: relative;
    width: 52px;
    height: 28px;
    background: rgba(26, 26, 78, 0.2);
    border-radius: 999px;
    border: none;
    cursor: pointer;
    transition: background 0.2s;
    flex-shrink: 0;
  }

  .toggle-switch.active {
    background: #4ecdc4;
  }

  .toggle-switch:hover {
    opacity: 0.9;
  }

  .toggle-slider {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 24px;
    height: 24px;
    background: white;
    border-radius: 50%;
    transition: transform 0.2s;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  .toggle-switch.active .toggle-slider {
    transform: translateX(24px);
  }

  @media (max-width: 640px) {
    .profile-container {
      padding: 1rem;
      overflow-x: hidden;
    }

    .profile-card {
      padding: 2rem 1.5rem;
      max-width: 100%;
      overflow-x: hidden;
    }

    .avatar {
      width: 100px;
      height: 100px;
    }

    .profile-name {
      font-size: 1.625rem;
    }

    .purchase-main {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.75rem;
    }

    /* Keep identity-main in a single row on mobile */
    .identity-main {
      gap: 0.75rem;
      /* Stay in row, don't change to column */
    }


    .identity-hearts {
      width: 56px;
      height: 56px;
      flex-shrink: 0;
      /* Keep fixed size, don't expand to full width */
    }

    .heart-icon-large {
      width: 40px;
      height: 40px;
    }
  }
</style>
