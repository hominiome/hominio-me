<script>
  import { onMount } from "svelte";
  import { authClient } from "$lib/auth.client.js";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { nanoid } from "nanoid";
  import { useZero } from "$lib/zero-utils";
  import { getUserProfile } from "$lib/userProfileCache";
  import MatchDetail from "$lib/MatchDetail.svelte";
  import MatchListItem from "$lib/MatchListItem.svelte";
  import { showError, showInfo } from "$lib/toastStore.js";
  import { formatEndDate, getMatchEndDate } from "$lib/dateUtils.js";
  import CountdownTimer from "$lib/CountdownTimer.svelte";
  import { calculatePrizePool, formatPrizePool } from "$lib/prizePoolUtils.js";

  const zeroContext = useZero();
  const session = authClient.useSession();
  const cupId = $page.params.cupId;

  // Check if user is admin
  $effect(() => {
    (async () => {
      if (!$session.isPending && $session.data?.user) {
        try {
          const response = await fetch("/alpha/api/is-admin");
          if (response.ok) {
            const data = await response.json();
            isAdmin = data.isAdmin;
          }
        } catch (error) {
          console.error("Failed to check admin status:", error);
        }
      }
    })();
  });

  let zero = null;
  let cup = $state(null);
  let projects = $state([]);
  let matches = $state([]);
  let votes = $state([]); // All vote records
  let purchases = $state([]); // All identity purchases for this cup
  let userIdentity = $state(null);
  let userVotes = $state([]); // Track which matches user has voted on
  let loading = $state(true);
  let voting = $state(false);
  let votingAnimation = $state(null); // Track which side is animating
  let expandedVideo = $state(null); // Track which match video is expanded
  let expandedMatch = $state(null); // Track which match is expanded (accordion)
  let creatorProfile = $state(null);
  let isAdmin = $state(false);
  let votingSound = $state(null); // Preloaded audio instance

  onMount(() => {
    // Preload voting sound for instant playback
    try {
      votingSound = new Audio("/voting-effect.mp3");
      votingSound.volume = 0.5;
      votingSound.preload = "auto";
      // Force preload by loading the audio
      votingSound.load();
    } catch (error) {
      console.warn("Could not preload voting sound:", error);
    }

    let cupView;
    let projectsView;
    let matchesView;
    let votesView;
    let purchasesView;

    (async () => {
      // Wait for Zero to be ready
      while (!zeroContext.isReady() || !zeroContext.getInstance()) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      zero = zeroContext.getInstance();

      // Query cup
      const cupQuery = zero.query.cup.where("id", "=", cupId);
      cupView = cupQuery.materialize();

      let hasReceivedData = false;
      let dataCheckTimeout = null;

      cupView.addListener(async (data) => {
        const cups = Array.from(data);

        // Mark that we've received at least one data update
        hasReceivedData = true;

        if (cups.length > 0) {
          cup = cups[0];
          loading = false;
          if (dataCheckTimeout) clearTimeout(dataCheckTimeout);

          // Fetch creator profile
          if (cup.creatorId) {
            const profile = await getUserProfile(cup.creatorId);
            creatorProfile = { name: profile.name, image: profile.image };
          }
        } else if (hasReceivedData) {
          loading = false;
        }
      });

      // After 3 seconds, if still no cup data, redirect back
      dataCheckTimeout = setTimeout(() => {
        if (!cup) {
          goto("/alpha/cups");
        }
      }, 3000);

      // Query all projects
      const projectsQuery = zero.query.project;
      projectsView = projectsQuery.materialize();

      projectsView.addListener((data) => {
        projects = Array.from(data);
      });

      // Query cup matches
      const matchesQuery = zero.query.cupMatch
        .where("cupId", "=", cupId)
        .orderBy("position", "asc");
      matchesView = matchesQuery.materialize();

      matchesView.addListener((data) => {
        matches = Array.from(data);
      });

      // Query all votes for vote counts and voter display
      const votesQuery = zero.query.vote;
      votesView = votesQuery.materialize();

      votesView.addListener((data) => {
        votes = Array.from(data);
      });

      // Query identity purchases for this cup for prize pool calculation
      const purchasesQuery = zero.query.identityPurchase.where(
        "cupId",
        "=",
        cupId
      );
      purchasesView = purchasesQuery.materialize();

      purchasesView.addListener((data) => {
        purchases = Array.from(data);
      });

      // Query user's identity and votes if logged in
      let userIdentityView;
      let userVotesView;

      if ($session.data?.user) {
        const userId = $session.data.user.id;

        // Query user's identity for this specific cup
        const userIdentityQuery = zero.query.userIdentities
          .where("userId", "=", userId)
          .where("cupId", "=", cupId);
        userIdentityView = userIdentityQuery.materialize();

        userIdentityView.addListener((data) => {
          const identities = Array.from(data);
          if (identities.length > 0) {
            userIdentity = identities[0];
          } else {
            userIdentity = null;
          }
        });

        // Query user's votes to check which matches they've voted on
        const userVotesQuery = zero.query.vote.where("userId", "=", userId);
        userVotesView = userVotesQuery.materialize();

        userVotesView.addListener((data) => {
          userVotes = Array.from(data);
        });
      }

      return () => {
        if (cupView) cupView.destroy();
        if (projectsView) projectsView.destroy();
        if (matchesView) matchesView.destroy();
        if (votesView) votesView.destroy();
        if (purchasesView) purchasesView.destroy();
        if (userIdentityView) userIdentityView.destroy();
        if (userVotesView) userVotesView.destroy();
      };
    })();
  });

  function getProjectById(id) {
    return projects.find((p) => p.id === id);
  }

  // Calculate vote totals from vote table
  function getMatchVotes(matchId, projectSide) {
    return votes
      .filter((v) => v.matchId === matchId && v.projectSide === projectSide)
      .reduce((sum, v) => sum + (v.votingWeight || 0), 0);
  }

  function getStatusLabel(status) {
    switch (status) {
      case "draft":
        return "Application Open";
      case "active":
        return "Active";
      case "completed":
        return "Completed";
      default:
        return status;
    }
  }

  function getRoundLabel(round) {
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

  function hasUserVotedOnMatch(matchId) {
    return userVotes.some((vote) => vote.matchId === matchId);
  }

  function getUserVotedSide(matchId) {
    const vote = userVotes.find((vote) => vote.matchId === matchId);
    return vote?.projectSide || null;
  }

  function getUserVotingWeight() {
    return userIdentity?.votingWeight || 0;
  }

  async function voteOnMatch(matchId, projectSide) {
    if (!$session.data?.user) {
      showError("Please sign in to vote!");
      goto("/alpha");
      return;
    }

    if (voting) return;

    // Check if user has an identity
    if (!userIdentity) {
      // Redirect to invite-only page (purchase is disabled, invite-only mode)
      // Open invite modal on current route
      const url = new URL($page.url);
      url.searchParams.set("modal", "invite");
      goto(url.pathname + url.search, { replaceState: false });
      return;
    }

    // Check if user already voted on this match
    if (hasUserVotedOnMatch(matchId)) {
      showInfo(
        "You have already voted on this match. Each user can vote once per match."
      );
      return;
    }

    // Find the match and check if user owns either project
    const match = matches.find((m) => m.id === matchId);
    if (!match) return;

    const project =
      projectSide === "project1"
        ? getProjectById(match.project1Id)
        : getProjectById(match.project2Id);

    if (project && project.userId === $session.data.user.id) {
      showError("You cannot vote for your own project!");
      return;
    }

    // Trigger animation IMMEDIATELY (no delay)
    // Keep it for 3 seconds to match overlay and progress bar animations
    votingAnimation = `${matchId}-${projectSide}`;

    // Play voting sound effect INSTANTLY using preloaded audio
    if (votingSound) {
      try {
        // Reset to beginning and play instantly
        votingSound.currentTime = 0;
        const playPromise = votingSound.play();
        if (playPromise !== undefined) {
          playPromise.catch((error) => {
            console.warn("Could not play voting sound:", error);
          });
        }
      } catch (error) {
        console.warn("Could not play voting sound:", error);
      }
    }
    setTimeout(() => {
      votingAnimation = null;
    }, 3000);

    // Fire and forget - Zero's reactive sync handles the rest
    // Note: amount is no longer sent - API uses package weight automatically
    fetch("/alpha/api/vote-match", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        matchId,
        projectSide,
      }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const error = await response.json();
          showError(`Vote failed: ${error.error || "Unknown error"}`);
        }
      })
      .catch((error) => {
        console.error("Vote failed:", error);
        showError("Vote failed. Please try again.");
      });

    // UI stays unlocked - Zero syncs reactively
  }

  function isMatchActive(match) {
    // Match is active if:
    // 1. Status is "voting", OR
    // 2. Status is "pending" AND cup is active AND match is in current round
    if (match.status === "voting") return true;
    if (
      match.status === "pending" &&
      cup?.status === "active" &&
      cup?.currentRound === match.round
    ) {
      return true;
    }
    return false;
  }

  function canUserVoteOnMatch(match) {
    if (!$session.data?.user) return false;
    const userId = $session.data.user.id;
    const project1 = getProjectById(match.project1Id);
    const project2 = getProjectById(match.project2Id);
    // User cannot vote if they own either project
    // Also need both projects to exist
    if (!project1 || !project2) return false;
    return project1.userId !== userId && project2.userId !== userId;
  }

  function toggleVideo(matchId) {
    if (expandedVideo === matchId) {
      expandedVideo = null;
    } else {
      expandedVideo = matchId;
    }
  }

  const isCreator = $derived(cup?.creatorId === $session.data?.user?.id);
</script>

<div class="min-h-screen bg-cream p-4 md:p-8">
  <div class="max-w-7xl mx-auto">
    {#if loading}
      <div class="card p-8 text-center">
        <p class="text-navy/70">Loading cup...</p>
      </div>
    {:else if cup}
      <!-- Header -->
      <div class="mb-8">
        <a
          href="/alpha/cups"
          class="text-teal hover:underline mb-4 inline-block"
        >
          ← Back to Cups
        </a>
        <div
          class="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
        >
          <div class="flex items-start gap-3 md:gap-4">
            {#if cup.logoImageUrl}
              <img
                src={cup.logoImageUrl}
                alt="{cup.name} logo"
                class="cup-logo-detail"
              />
            {/if}
            <div>
              <h1 class="text-3xl md:text-5xl font-bold text-navy mb-2">
                {cup.name}
              </h1>
              {#if cup.description}
                <p class="text-navy/60 text-base md:text-lg">
                  {cup.description}
                </p>
              {/if}
            </div>
          </div>
          <div class="flex flex-col sm:flex-row gap-2 md:gap-3">
            {#if isCreator}
              <a
                href="/alpha/cups/{cupId}/admin"
                class="btn-primary text-center"
              >
                Admin Panel
              </a>
            {/if}
            {#if isCreator || isAdmin}
              <a
                href="/alpha/cups?modal=edit-cup&cupId={cupId}"
                class="btn-secondary text-center"
              >
                Edit
              </a>
            {/if}
          </div>
        </div>
      </div>

      <!-- Cup Info -->
      <div class="card p-4 md:p-6 mb-6 md:mb-8">
        <div class="flex flex-row items-center gap-3 md:gap-8 flex-wrap">
          <div class="flex-shrink-0">
            <p class="text-navy/60 text-xs md:text-sm mb-1">Status</p>
            <p class="text-sm md:text-lg lg:text-xl font-bold text-navy">
              {getStatusLabel(cup.status)}
            </p>
          </div>
          {#if cup.currentRound}
            <div class="flex-shrink-0">
              <p class="text-navy/60 text-xs md:text-sm mb-1">Current Round</p>
              <p class="text-sm md:text-lg lg:text-xl font-bold text-teal">
                {getRoundLabel(cup.currentRound)}
              </p>
            </div>
          {/if}
          <div class="flex-shrink-0">
            <p class="text-navy/60 text-xs md:text-sm mb-1">Prize Pool</p>
            <p class="text-sm md:text-lg lg:text-xl font-bold text-yellow">
              {formatPrizePool(calculatePrizePool(purchases))}
            </p>
          </div>
          {#if cup.status === "active" && cup.currentRound}
            {@const currentRoundMatches = matches.filter(
              (m) => m.round === cup.currentRound
            )}
            {@const roundEndDate =
              currentRoundMatches.length > 0
                ? getMatchEndDate(currentRoundMatches[0], currentRoundMatches)
                : ""}
            {#if roundEndDate}
              <div class="flex-shrink-0">
                <p class="text-navy/60 text-xs md:text-sm mb-1">
                  Round Ends In
                </p>
                <p class="text-sm md:text-lg lg:text-xl font-bold text-teal">
                  <CountdownTimer endDate={roundEndDate} displayFormat="full" />
                </p>
              </div>
            {/if}
          {/if}
          {#if cup.winnerId}
            {@const winner = getProjectById(cup.winnerId)}
            <div class="flex items-center gap-2 flex-shrink-0 ml-auto">
              <svg
                class="w-4 h-4 md:w-5 md:h-5 lg:w-6 lg:h-6 text-yellow"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                />
              </svg>
              <div>
                <p class="text-navy/60 text-xs md:text-sm">Winner</p>
                <p class="text-sm md:text-lg lg:text-xl font-bold text-yellow">
                  {winner?.title || "Unknown"}
                </p>
              </div>
            </div>
          {/if}
        </div>
      </div>

      <!-- Matches by Round -->
      {#if matches.length === 0}
        <div class="card p-12 text-center">
          <h2 class="text-3xl font-bold text-navy mb-4">No Matches Yet</h2>
          <p class="text-navy/60">
            {#if isCreator}
              Go to the admin panel to set up the tournament.
            {:else}
              The cup creator hasn't set up matches yet.
            {/if}
          </p>
        </div>
      {:else}
        <div class="space-y-8">
          {#if cup}
            {@const roundsToShow = (() => {
              // Dynamically determine which rounds to show based on cup size
              const cupSize = cup.size || 16;
              const rounds = [];

              // Add first round based on size
              rounds.push(`round_${cupSize}`);

              // Add intermediate rounds if needed
              if (cupSize >= 32) rounds.push("round_16");
              if (cupSize >= 64) rounds.push("round_32");
              if (cupSize >= 128) rounds.push("round_64");

              // Add standard rounds
              if (cupSize >= 16) rounds.push("quarter");
              if (cupSize >= 8) rounds.push("semi");
              rounds.push("final");

              return rounds;
            })()}
            {#each roundsToShow as round}
              {@const roundMatches = matches.filter((m) => m.round === round)}
              {#if roundMatches.length > 0}
                <div class="round-container">
                  <h2 class="round-header">
                    {getRoundLabel(round)}
                  </h2>
                  <div class="round-matches">
                    {#each roundMatches as match}
                      {@const project1 = getProjectById(match.project1Id)}
                      {@const project2 = getProjectById(match.project2Id)}
                      {@const votes1 = getMatchVotes(match.id, "project1")}
                      {@const votes2 = getMatchVotes(match.id, "project2")}
                      {@const totalVotes = votes1 + votes2}
                      {@const percent1 =
                        totalVotes > 0 ? (votes1 / totalVotes) * 100 : 50}
                      {@const percent2 =
                        totalVotes > 0 ? (votes2 / totalVotes) * 100 : 50}
                      {@const isActive = isMatchActive(match)}
                      {@const hasVoted = hasUserVotedOnMatch(match.id)}
                      {@const userVotingWeight = getUserVotingWeight()}
                      {@const userVotedSide = getUserVotedSide(match.id)}
                      {@const canVote = canUserVoteOnMatch(match)}
                      <!-- Match List Item Component -->
                      <MatchListItem
                        {match}
                        {project1}
                        {project2}
                        {votes1}
                        {votes2}
                        {percent1}
                        {percent2}
                        {isActive}
                        {expandedMatch}
                        {expandedVideo}
                        {votingAnimation}
                        {votes}
                        session={$session}
                        {getRoundLabel}
                        {hasVoted}
                        {userVotingWeight}
                        {userVotedSide}
                        {canVote}
                        {roundMatches}
                        onToggleExpand={() =>
                          (expandedMatch =
                            expandedMatch === match.id ? null : match.id)}
                        {toggleVideo}
                        {voteOnMatch}
                      />
                    {/each}
                  </div>
                </div>
              {/if}
            {/each}
          {/if}
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .bg-cream {
    background-color: #fef9f0;
  }

  .card {
    background: white;
    border-radius: 16px;
    box-shadow: 0 2px 12px rgba(26, 26, 78, 0.06);
    border: 1px solid rgba(26, 26, 78, 0.08);
  }

  /* Round container - card on desktop, no card on mobile */
  .round-container {
    background: white;
    border-radius: 16px;
    box-shadow: 0 2px 12px rgba(26, 26, 78, 0.06);
    border: 1px solid rgba(26, 26, 78, 0.08);
    padding: 1rem 1.5rem;
  }

  @media (max-width: 768px) {
    .round-container {
      background: transparent;
      box-shadow: none;
      border: none;
      padding: 0;
      margin-bottom: 1.5rem;
    }
  }

  .round-header {
    font-size: 1.25rem;
    font-weight: 700;
    color: #1a1a4e;
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 2px solid rgba(26, 26, 78, 0.1);
  }

  @media (min-width: 768px) {
    .round-header {
      font-size: 1.5rem;
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
    }
  }

  .round-matches {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  @media (min-width: 768px) {
    .round-matches {
      gap: 0.75rem;
    }
  }

  .btn-primary {
    padding: 0.75rem 1.5rem;
    background: linear-gradient(135deg, #4ecdc4 0%, #1a1a4e 100%);
    color: white;
    border-radius: 12px;
    font-weight: 600;
    text-decoration: none;
    display: inline-block;
    transition: all 0.2s;
  }

  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(78, 205, 196, 0.3);
  }

  .btn-secondary {
    padding: 0.75rem 1.5rem;
    background: white;
    color: #1a1a4e;
    border: 2px solid rgba(26, 26, 78, 0.1);
    border-radius: 12px;
    font-weight: 600;
    text-decoration: none;
    display: inline-block;
    transition: all 0.2s;
  }

  .btn-secondary:hover {
    border-color: #4ecdc4;
    color: #4ecdc4;
    transform: translateY(-2px);
  }

  .text-navy {
    color: #1a1a4e;
  }

  .text-teal {
    color: #4ecdc4;
  }

  .text-yellow {
    color: #f4d03f;
  }

  .cup-logo-detail {
    width: 60px;
    height: 60px;
    object-fit: contain;
    border-radius: 12px;
    flex-shrink: 0;
  }

  @media (min-width: 768px) {
    .cup-logo-detail {
      width: 80px;
      height: 80px;
    }
  }

  /* Mobile responsive adjustments */
  @media (max-width: 640px) {
    .btn-primary,
    .btn-secondary {
      padding: 0.625rem 1.25rem;
      font-size: 0.875rem;
      width: 100%;
    }

    .card {
      border-radius: 12px;
    }

    .text-3xl {
      font-size: 1.75rem;
    }

    .text-base {
      font-size: 0.875rem;
    }
  }
</style>
