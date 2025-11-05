<script lang="ts">
  import { authClient } from "$lib/auth.client.js";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import { useZero } from "$lib/zero-utils";
  import { formatPrizePool } from "$lib/prizePoolUtils.js";
  import QRCodeDisplay from "$lib/QRCodeDisplay.svelte";
  import Modal from "$lib/Modal.svelte";
  import { page } from "$app/stores";
  import {
    allProjects,
    purchasesByUser,
    identitiesByUser,
    votesByUser,
    allMatches,
    allCups,
    userPreferencesByUser,
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
  let zero = $state<any>(null);
  let userIdentities = $state<any[]>([]);
  let purchases = $state<any[]>([]);
  let votes = $state<any[]>([]);
  let matches = $state<any[]>([]);
  let projects = $state<any[]>([]);
  let cups = $state<any[]>([]);
  let userPreferences = $state<any[]>([]);
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

  function getCupName(cupId: string) {
    const cup = cups.find((c) => c.id === cupId);
    return cup?.name || cupId;
  }

  function getProjectById(projectId: string) {
    return projects.find((p) => p.id === projectId);
  }

  function getProjectName(projectId: string) {
    const project = projects.find((p) => p.id === projectId);
    return project?.title || "Unknown Project";
  }

  function getMatchRound(matchId: string) {
    const match = matches.find((m) => m.id === matchId);
    return match?.round || "unknown";
  }

  function getRoundLabel(round: string) {
    switch (round) {
      case "round_4":
        return "Round of 4";
      case "round_8":
        return "Round of 8";
      case "round_16":
        return "Round of 16";
      case "round_32":
        return "Round of 32";
      case "round_64":
        return "Round of 64";
      case "round_128":
        return "Round of 128";
      case "quarter":
        return "Quarter Finals";
      case "semi":
        return "Semi Finals";
      case "final":
        return "Final";
      default:
        return round;
    }
  }

  onMount(() => {
    let identitiesView: any;
    let purchasesView: any;
    let votesView: any;
    let matchesView: any;
    let projectsView: any;
    let cupsView: any;
    let preferencesView: any;

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

      // Query user's votes using synced query
      const votesQuery = votesByUser(userId);
      votesView = zero.materialize(votesQuery);

      votesView.addListener((data: any) => {
        // Already sorted by createdAt desc from synced query
        votes = Array.from(data || []);
      });

      // Query all matches using synced query
      const matchesQuery = allMatches();
      matchesView = zero.materialize(matchesQuery);

      matchesView.addListener((data: any) => {
        matches = Array.from(data || []);
      });

      // Query all projects using synced query
      const projectsQuery = allProjects();
      projectsView = zero.materialize(projectsQuery);

      projectsView.addListener((data: any) => {
        projects = Array.from(data || []);
      });

      // Query all cups to get names using synced query
      const cupsQuery = allCups();
      cupsView = zero.materialize(cupsQuery);

      cupsView.addListener((data: any) => {
        cups = Array.from(data || []);
        loading = false;
      });

      // Query user preferences using synced query
      const preferencesQuery = userPreferencesByUser(userId);
      preferencesView = zero.materialize(preferencesQuery);

      preferencesView.addListener((data: any) => {
        userPreferences = Array.from(data || []);
      });
    })();

    return () => {
      if (identitiesView) identitiesView.destroy();
      if (purchasesView) purchasesView.destroy();
      if (votesView) votesView.destroy();
      if (matchesView) matchesView.destroy();
      if (projectsView) projectsView.destroy();
      if (cupsView) cupsView.destroy();
      if (preferencesView) preferencesView.destroy();
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
        updatedAt: new Date().toISOString(),
      });
    }
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
                        When you are a founder and want to apply with your project for the first Cup, message me now.<br><br>
                        Any other questions or requests, let me know too.
                      </p>
                    </div>

                    <p class="cta-message">
                      I am Samuel, HominioNo1<br>
                      and I am looking forward to chat with you.
                    </p>

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
          class="instagram-button-fullwidth"
        >
          <svg class="instagram-icon" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"
            />
          </svg>
          <span>Message Me For Feedback</span>
        </a>
      {/if}
    </div>

    {#if hasExplorerIdentity()}
      <div class="profile-section">
        <h2 class="section-title">Account Details</h2>
        <div class="details-grid">
          <div class="detail-item">
            <span class="detail-label">ID</span>
            <span class="detail-value detail-mono">{data.session?.id || "—"}</span
            >
          </div>
        </div>
      </div>
    {/if}

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
                    <span class="heart-count">{identity.votingWeight}</span>
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
          <h2 class="section-title">My Votes</h2>
        {#if votes.length === 0}
          <div class="empty-state">
            <p>You haven't voted on any matches yet.</p>
          </div>
        {:else}
          <div class="votes-list">
            {#each votes as vote}
              {@const match = matches.find((m) => m.id === vote.matchId)}
              {@const cup = match
                ? cups.find((c) => c.id === match.cupId)
                : null}
              {@const votedProject =
                vote.projectSide === "project1"
                  ? getProjectById(match?.project1Id)
                  : getProjectById(match?.project2Id)}
              {@const opponentProject =
                vote.projectSide === "project1"
                  ? getProjectById(match?.project2Id)
                  : getProjectById(match?.project1Id)}
              <div class="vote-item">
                <div class="vote-amount">
                  <span class="vote-plus">+</span>
                  <span class="vote-number">{vote.votingWeight || 1}</span>
                </div>
                <div class="vote-details">
                  {#if votedProject?.id}
                    <a
                      href="/alpha/projects/{votedProject.id}"
                      class="vote-project-link"
                    >
                      {getProjectName(votedProject.id)}
                    </a>
                  {:else}
                    <span class="vote-project">
                      {getProjectName(votedProject?.id || "")}
                    </span>
                  {/if}
                  <span class="vote-meta">
                    <span class="vote-cup">{cup?.name || "Unknown Cup"}</span>
                    {#if match}
                      <span class="vote-round">
                        • {getRoundLabel(match.round)}</span
                      >
                    {/if}
                    {#if opponentProject}
                      <span class="vote-opponent">
                        vs
                        {#if opponentProject?.id}
                          <a
                            href="/alpha/projects/{opponentProject.id}"
                            class="vote-opponent-link"
                          >
                            {getProjectName(opponentProject.id)}
                          </a>
                        {:else}
                          {opponentProject
                            ? getProjectName(opponentProject.id)
                            : "Unknown"}
                        {/if}
                      </span>
                    {/if}
                  </span>
                </div>
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
                    {formatPrizePool(purchase.price)}
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
    background: linear-gradient(135deg, #f0fffe 0%, #fff9e6 100%);
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
    margin: 0 0 1.5rem 0;
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
    margin: 1.5rem 0;
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

  .instagram-button-fullwidth {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.875rem 1.5rem;
    margin: 1.5rem 0;
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

  .instagram-button-fullwidth:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 20px rgba(188, 24, 136, 0.5);
  }

  .instagram-button-fullwidth:active {
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

  .link-label {
    font-size: 0.875rem;
    color: rgba(26, 26, 78, 0.8);
    text-align: center;
    margin: 0;
    font-weight: 500;
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

  .cta-message {
    font-size: 0.875rem;
    color: rgba(26, 26, 78, 0.7);
    line-height: 1.5;
    margin: 1rem 0;
    text-align: center;
  }

  .qr-section :global(.qr-container) {
    background: transparent;
    padding: 1rem;
    border-radius: 8px;
  }


  .invite-link-section {
    width: 100%;
    max-width: 500px;
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

    .instagram-button,
    .instagram-button-fullwidth {
      padding: 0.625rem 1.25rem;
      font-size: 0.813rem;
    }

    .instagram-icon {
      width: 16px;
      height: 16px;
    }

    .link-container {
      flex-direction: column;
    }

    .link-input {
      width: 100%;
    }

    .copy-button {
      width: 100%;
    }
  }

  @media (max-width: 480px) {
    .qr-code-section {
      padding: 0.5rem;
      margin: 0.75rem 0;
    }
  }

  .profile-section {
    margin-bottom: 2rem;
  }

  .section-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: #111827;
    margin: 0 0 1rem 0;
  }

  .details-grid {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .detail-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: #f9fafb;
    border-radius: 8px;
  }

  .detail-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .detail-value {
    font-size: 1rem;
    font-weight: 600;
    color: #111827;
  }

  .detail-mono {
    font-family: monospace;
    font-size: 0.875rem;
    color: #6b7280;
  }

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

  .empty-state-link {
    display: inline-block;
    margin-top: 0.5rem;
    color: #4fc3c3;
    font-weight: 600;
    text-decoration: none;
  }

  .empty-state-link:hover {
    text-decoration: underline;
  }

  .identities-list,
  .purchases-list,
  .votes-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .identity-item,
  .purchase-item,
  .vote-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.875rem 1rem;
    background: #f9fafb;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
  }

  .vote-amount {
    display: flex;
    align-items: baseline;
    gap: 0.125rem;
    flex-shrink: 0;
  }

  .vote-plus {
    font-size: 1.5rem;
    font-weight: 700;
    color: #4ecdc4;
  }

  .vote-number {
    font-size: 1.75rem;
    font-weight: 800;
    color: #1a1a4e;
    line-height: 1;
  }

  .vote-details {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex: 1;
    min-width: 0;
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

  .heart-count {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 1.25rem;
    font-weight: 800;
    color: #fff8dc;
    text-shadow: 0 1px 2px rgba(244, 208, 63, 0.3);
    line-height: 1;
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

  .vote-project-link,
  .vote-opponent-link {
    text-decoration: none;
    font-size: 0.9375rem;
    font-weight: 600;
    color: #111827;
    transition: color 0.2s;
  }

  .vote-project-link:hover,
  .vote-opponent-link:hover {
    color: #4ecdc4;
    text-decoration: underline;
  }

  .vote-project {
    font-size: 0.9375rem;
    font-weight: 600;
    color: #111827;
  }

  .identity-name {
    font-size: 0.9375rem;
    font-weight: 600;
    color: #111827;
  }

  .purchase-identity {
    color: #111827;
  }

  .vote-meta {
    font-size: 0.8125rem;
    color: #6b7280;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .vote-cup {
    font-weight: 500;
  }

  .vote-round {
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-size: 0.75rem;
  }

  .vote-opponent {
    font-style: italic;
  }

  .identity-upgrade {
    margin-top: 0.5rem;
    font-size: 0.75rem;
    color: #9ca3af;
    font-style: italic;
  }

  .heart-count {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 1.25rem;
    font-weight: 800;
    color: #fff8dc;
    text-shadow: 0 1px 2px rgba(244, 208, 63, 0.3);
    line-height: 1;
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
    }

    .profile-card {
      padding: 2rem 1.5rem;
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

    /* Keep identity-main in a single row on mobile - don't stack like votes */
    .identity-main {
      gap: 0.75rem;
      /* Stay in row, don't change to column */
    }

    .vote-item {
      flex-direction: row;
      gap: 0.75rem;
    }

    .vote-number {
      font-size: 1.5rem;
    }

    .vote-plus {
      font-size: 1.25rem;
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

    .heart-count {
      font-size: 1.125rem;
    }
  }
</style>
