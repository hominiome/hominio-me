<script lang="ts">
  import { authClient } from "$lib/auth.client.js";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import { useZero } from "$lib/zero-utils";
  import { formatPrizePool } from "$lib/prizePoolUtils.js";
  import QRCodeDisplay from "$lib/QRCodeDisplay.svelte";

  // Session data from layout
  let { data } = $props();
  
  // Get the public profile URL
  let profileUrl = $derived(
    browser && data.session?.id 
      ? `${window.location.origin}/alpha/user/${data.session.id}` 
      : ""
  );

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
  let loading = $state(true);

  async function handleSignOut() {
    signingOut = true;
    await authClient.signOut();
    goto("/alpha");
  }

  function getIdentityLabel(identityType: string) {
    switch (identityType) {
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

      // Query user's identities
      const identitiesQuery = zero.query.userIdentities.where(
        "userId",
        "=",
        userId
      );
      identitiesView = identitiesQuery.materialize();

      identitiesView.addListener((data: any) => {
        userIdentities = Array.from(data || []);
      });

      // Query user's purchases
      const purchasesQuery = zero.query.identityPurchase.where(
        "userId",
        "=",
        userId
      );
      purchasesView = purchasesQuery.materialize();

      purchasesView.addListener((data: any) => {
        purchases = Array.from(data || []).sort(
          (a: any, b: any) =>
            new Date(b.purchasedAt).getTime() -
            new Date(a.purchasedAt).getTime()
        );
      });

      // Query user's votes
      const votesQuery = zero.query.vote.where("userId", "=", userId);
      votesView = votesQuery.materialize();

      votesView.addListener((data: any) => {
        votes = Array.from(data || []).sort(
          (a: any, b: any) =>
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime()
        );
      });

      // Query all matches
      const matchesQuery = zero.query.cupMatch;
      matchesView = matchesQuery.materialize();

      matchesView.addListener((data: any) => {
        matches = Array.from(data || []);
      });

      // Query all projects
      const projectsQuery = zero.query.project;
      projectsView = projectsQuery.materialize();

      projectsView.addListener((data: any) => {
        projects = Array.from(data || []);
      });

      // Query all cups to get names
      const cupsQuery = zero.query.cup;
      cupsView = cupsQuery.materialize();

      cupsView.addListener((data: any) => {
        cups = Array.from(data || []);
        loading = false;
      });
    })();

    return () => {
      if (identitiesView) identitiesView.destroy();
      if (purchasesView) purchasesView.destroy();
      if (votesView) votesView.destroy();
      if (matchesView) matchesView.destroy();
      if (projectsView) projectsView.destroy();
      if (cupsView) cupsView.destroy();
    };
  });
</script>

<div class="profile-container">
  <div class="profile-card">
    <div class="profile-header">
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
      
      {#if profileUrl}
        <div class="qr-code-section">
          <QRCodeDisplay data={profileUrl} />
        </div>
      {/if}
    </div>

    <div class="profile-section">
      <div class="sign-out-container">
        <button
          onclick={handleSignOut}
          disabled={signingOut}
          class="btn-sign-out"
        >
          <svg class="sign-out-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {signingOut ? "Signing out..." : "Sign Out"}
        </button>
      </div>
      <h2 class="section-title">Account Details</h2>
      <div class="details-grid">
        <div class="detail-item">
          <span class="detail-label">ID</span>
          <span class="detail-value detail-mono">{data.session?.id || "—"}</span>
        </div>
      </div>
    </div>

    {#if loading}
      <div class="profile-section">
        <p class="loading-text">Loading...</p>
      </div>
    {:else}
      <div class="profile-section">
        <h2 class="section-title">My Active Identities</h2>
        {#if userIdentities.length === 0}
          <div class="empty-state">
            <p>You don't have any active voting identities yet.</p>
            <a href="/alpha/purchase" class="empty-state-link">
              Purchase an identity to start voting
            </a>
          </div>
        {:else}
          <div class="identities-list">
            {#each userIdentities as identity}
              <div class="identity-item">
                <div class="identity-main">
                  <div class="identity-hearts">
                    <svg class="heart-icon-large" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                    <span class="heart-count">{identity.votingWeight}</span>
                  </div>
                  <div class="identity-info">
                    <span class="identity-name">
                      {getIdentityLabel(identity.identityType)}
                    </span>
                    <span class="identity-cup">
                      {getCupName(identity.cupId)}
                    </span>
                  </div>
                </div>
                {#if identity.upgradedFrom}
                  <div class="identity-upgrade">
                    Upgraded from {getIdentityLabel(identity.upgradedFrom)}
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
              {@const cup = match ? cups.find((c) => c.id === match.cupId) : null}
              {@const votedProject = vote.projectSide === "project1" ? getProjectById(match?.project1Id) : getProjectById(match?.project2Id)}
              {@const opponentProject = vote.projectSide === "project1" ? getProjectById(match?.project2Id) : getProjectById(match?.project1Id)}
              <div class="vote-item">
                <div class="vote-amount">
                  <span class="vote-plus">+</span>
                  <span class="vote-number">{vote.votingWeight || 1}</span>
                </div>
                  <div class="vote-details">
                    {#if votedProject?.id}
                      <a href="/alpha/projects/{votedProject.id}" class="vote-project-link">
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
                        <span class="vote-round"> • {getRoundLabel(match.round)}</span>
                      {/if}
                      {#if opponentProject}
                        <span class="vote-opponent"> vs 
                          {#if opponentProject?.id}
                            <a href="/alpha/projects/{opponentProject.id}" class="vote-opponent-link">
                              {getProjectName(opponentProject.id)}
                            </a>
                          {:else}
                            {opponentProject ? getProjectName(opponentProject.id) : "Unknown"}
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
                    <span class="purchase-cup">
                      {getCupName(purchase.cupId)}
                    </span>
                    <span class="purchase-date">
                      {new Date(purchase.purchasedAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
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

  </div>
</div>

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
    max-width: 600px;
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

  .qr-code-section {
    margin: 1.5rem 0;
    display: flex;
    justify-content: center;
    padding: 1rem;
    background: rgba(78, 205, 196, 0.02);
    border-radius: 12px;
    width: 100%;
    overflow: hidden;
  }

  @media (max-width: 768px) {
    .qr-code-section {
      padding: 0.75rem;
      margin: 1rem 0;
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

  .sign-out-container {
    margin-bottom: 1.5rem;
  }

  .btn-sign-out {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    background: white;
    color: #dc2626;
    border: 1px solid #dc2626;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    width: 100%;
    justify-content: center;
  }

  .btn-sign-out:hover:not(:disabled) {
    background: #dc2626;
    color: white;
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

  .identity-cup,
  .purchase-cup {
    font-size: 0.8125rem;
    color: #6b7280;
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

