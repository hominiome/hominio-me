<script>
  import { onMount } from "svelte";
  import { authClient } from "$lib/auth.client.js";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { useZero } from "$lib/zero-utils";
  import { getUserProfile } from "$lib/userProfileCache";
  import MatchDetail from "$lib/MatchDetail.svelte";
  import MatchListItem from "$lib/MatchListItem.svelte";
  import { showError, showInfo } from "$lib/toastStore.js";
  import { getMatchEndDate } from "$lib/dateUtils.js";
  import CountdownTimer from "$lib/CountdownTimer.svelte";
  import { calculatePrizePool, formatPrizePool } from "$lib/prizePoolUtils.js";
  import CupHeader from "$lib/CupHeader.svelte";
  import WinnerCard from "$lib/components/WinnerCard.svelte";
  import { PageHeader } from "$lib/design-system/molecules";
  import Icon from "$lib/design-system/atoms/Icon.svelte";
  import Loading from "$lib/components/Loading.svelte";
  import {
    allProjects,
    allPurchases,
    identitiesByUser,
    allVotes,
    votesByUser,
    allCups,
    allMatches,
  } from "$lib/synced-queries";

  const zeroContext = useZero();
  const session = authClient.useSession();

  let zero = null;
  let cups = $state([]);
  let projects = $state([]);
  let matches = $state([]); // All matches from database
  let votes = $state([]);
  let userIdentities = $state([]); // All user identities (cup-specific)
  let userVotes = $state([]);
  let purchases = $state([]); // All identity purchases for prize pool calculation
  let loading = $state(true);
  let voting = $state(false);
  let votingAnimation = $state(null);
  let expandedVideo = $state(null);
  let expandedMatch = $state(null);
  let votingSound = $state(null); // Preloaded audio instance
  let championsExpanded = $state(false); // Collapsible Previous Champions section

  // Filter and group active matches by cup and round
  let groupedMatches = $derived.by(() => {
    // If no matches or cups, return empty
    if (matches.length === 0 || cups.length === 0) {
      return [];
    }

    const groups = new Map();

    const activeMatches = [];
    for (const match of matches) {
      const isActive = isMatchActive(match);
      if (isActive) {
        activeMatches.push(match);
      }
    }

    for (const match of activeMatches) {
      const cup = getCupById(match.cupId);
      const cupName = cup?.name || "Unknown Cup";
      const round = match.round || "unknown";
      const key = `${cupName}|${round}`;

      if (!groups.has(key)) {
        groups.set(key, {
          cupName,
          cupId: match.cupId,
          round,
          matches: [],
        });
      }
      groups.get(key).matches.push(match);
    }

    // Convert to array and sort by cup name, then round order
    const roundOrder = {
      round_128: 1,
      round_64: 2,
      round_32: 3,
      round_16: 4,
      round_8: 4,
      round_4: 4,
      quarter: 5,
      semi: 6,
      final: 7,
    };
    return Array.from(groups.values()).sort((a, b) => {
      if (a.cupName !== b.cupName) {
        return a.cupName.localeCompare(b.cupName);
      }
      return (roundOrder[a.round] || 99) - (roundOrder[b.round] || 99);
    });
  });

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

    let cupsView;
    let projectsView;
    let matchesView;
    let votesView;

    (async () => {
      // Wait for Zero to be ready
      while (!zeroContext.isReady() || !zeroContext.getInstance()) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      zero = zeroContext.getInstance();

      // Query all cups (we need all cups to check match status, not just active ones)
      const cupsQuery = allCups();
      cupsView = zero.materialize(cupsQuery);

      cupsView.addListener(async (data) => {
        cups = Array.from(data);

        // Check if any cups/matches have expired and close them
        try {
          await fetch("/alpha/api/check-expiry", {
            method: "GET",
          });
        } catch (error) {
          console.warn("Failed to check expiry:", error);
        }

        // Set loading to false once we have the cups data (even if empty)
        loading = false;
      });

      // Query all projects
      const projectsQuery = allProjects();
      projectsView = zero.materialize(projectsQuery);

      projectsView.addListener((data) => {
        projects = Array.from(data);
      });

      // Query all matches (filtering happens reactively in $derived)
      const matchesQuery = allMatches();
      matchesView = zero.materialize(matchesQuery);

      matchesView.addListener(async (data) => {
        // Store all matches - filtering by active cups happens reactively
        matches = Array.from(data);

        // Check if any matches have expired and close them
        try {
          await fetch("/alpha/api/check-expiry", {
            method: "GET",
          });
        } catch (error) {
          console.warn("Failed to check expiry:", error);
        }
      });

      // Query all votes for vote counts using synced query
      const votesQuery = allVotes();
      votesView = zero.materialize(votesQuery);

      votesView.addListener((data) => {
        votes = Array.from(data);
      });

      // Query all identity purchases for prize pool calculation using synced query
      const purchasesQuery = allPurchases();
      const purchasesView = zero.materialize(purchasesQuery);

      purchasesView.addListener((data) => {
        purchases = Array.from(data);
      });

      // Query user's identities and votes if logged in
      let userIdentityView;
      let userVotesView;

      if ($session.data?.user) {
        const userId = $session.data.user.id;

        // Query all user identities (cup-specific) using synced query
        const userIdentityQuery = identitiesByUser(userId);
        userIdentityView = zero.materialize(userIdentityQuery);

        userIdentityView.addListener((data) => {
          userIdentities = Array.from(data);
        });

        // Query user's votes using synced query
        const userVotesQuery = votesByUser(userId);
        userVotesView = zero.materialize(userVotesQuery);

        userVotesView.addListener((data) => {
          userVotes = Array.from(data);
        });
      }

      return () => {
        if (cupsView) cupsView.destroy();
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

  function getCupById(id) {
    return cups.find((c) => c.id === id);
  }

  function getMatchVotes(matchId, projectSide) {
    return votes
      .filter((v) => v.matchId === matchId && v.projectSide === projectSide)
      .reduce((sum, v) => sum + (v.votingWeight || 0), 0);
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

  function getUserVotingWeight(match) {
    // Get universal identity (all identities are now universal, cupId = null)
    const identity = userIdentities.find((id) => id.cupId === null && id.votingWeight > 0);
    return identity?.votingWeight || 0;
  }

  function canUserVoteOnMatch(match) {
    if (!$session.data?.user) return false;
    const userId = $session.data.user.id;
    const project1 = getProjectById(match.project1Id);
    const project2 = getProjectById(match.project2Id);
    // User cannot vote if they own either project
    // Also need both projects to exist
    if (!project1 || !project2) return false;
    // Show voting buttons if user is logged in and doesn't own either project
    // (We'll check for identity when they actually try to vote)
    return project1.userId !== userId && project2.userId !== userId;
  }

  function toggleMatchExpand(matchId) {
    const url = new URL(window.location.href);
    if (expandedMatch === matchId) {
      expandedMatch = null;
      // Remove matchId from URL
      url.searchParams.delete("matchId");
    } else {
      expandedMatch = matchId;
      // Add matchId to URL
      url.searchParams.set("matchId", matchId);
    }
    // Update URL without reloading
    goto(url.pathname + url.search, { replaceState: true, noScroll: true });
  }

  // Handle route params on mount and when URL changes
  $effect(() => {
    const matchIdParam = $page.url.searchParams.get("matchId");
    if (matchIdParam) {
      // Check if match exists and is active
      const match = matches.find((m) => m.id === matchIdParam);
      if (match && isMatchActive(match)) {
        expandedMatch = matchIdParam;
        // Scroll to match after a short delay to ensure DOM is ready
        setTimeout(() => {
          const element = document.querySelector(
            `[data-match-id="${matchIdParam}"]`
          );
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, 300);
      } else if (matchIdParam && !match) {
        // Match not found yet, might still be loading - wait a bit
        // The effect will re-run when matches updates
      } else if (matchIdParam && match && !isMatchActive(match)) {
        // Match exists but is not active - remove from URL
        const url = new URL(window.location.href);
        url.searchParams.delete("matchId");
        goto(url.pathname + url.search, { replaceState: true });
      }
    } else {
      // No matchId in URL, but if we have an expanded match, it should be collapsed
      // Don't auto-collapse if user manually collapsed it
      if (expandedMatch && !matchIdParam) {
        // User likely collapsed manually, URL should already be updated
      }
    }
  });

  function toggleVideo(videoKey) {
    if (expandedVideo === videoKey) {
      expandedVideo = null;
    } else {
      expandedVideo = videoKey;
    }
  }

  async function voteOnMatch(matchId, projectSide) {
    if (!$session.data?.user) {
      showError("Please sign in to vote!");
      goto("/alpha");
      return;
    }

    if (voting) return;

    // Find the match first
    const match = matches.find((m) => m.id === matchId);
    if (!match) return;

    // Check if user already voted on this match
    if (hasUserVotedOnMatch(matchId)) {
      showInfo(
        "You have already voted on this match. Each user can vote once per match."
      );
      return;
    }

    // Check if user owns either project
    const project =
      projectSide === "project1"
        ? getProjectById(match.project1Id)
        : getProjectById(match.project2Id);

    if (project && project.userId === $session.data.user.id) {
      showError("You cannot vote for your own project!");
      return;
    }

    // Check if user has a universal voting identity (all identities are now universal, cupId = null)
    const hasVotingIdentity = userIdentities.some(
      (id) => id.cupId === null && id.votingWeight > 0
    );
    
    if (!hasVotingIdentity) {
      // User has explorer identity but no voting identity - redirect to purchase page
      goto(`/alpha/purchase?returnUrl=${encodeURIComponent($page.url.pathname + $page.url.search)}`, { replaceState: false });
      return;
    }

    // Trigger animation IMMEDIATELY (no delay)
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
  }

  function isMatchActive(match) {
    // Match is active if:
    // 1. Status is "voting", OR
    // 2. Status is "pending" AND cup is active AND match is in current round
    // Exclude matches where cup is completed or match is completed
    const cup = getCupById(match.cupId);

    // Exclude matches from completed cups
    if (cup?.status === "completed") {
      return false;
    }

    // Exclude matches that are completed
    if (match.status === "completed") {
      return false;
    }

    // Always return true for voting status (if cup is active)
    if (match.status === "voting" && cup?.status === "active") {
      return true;
    }

    // Check pending matches
    if (match.status === "pending") {
      const cupActive = cup?.status === "active";
      const matchInCurrentRound = cup?.currentRound === match.round;
      const shouldBeActive = cupActive && matchInCurrentRound;

      if (shouldBeActive) {
        return true;
      }
    }

    return false;
  }

  // Filter completed cups with winners
  const completedCupsWithWinners = $derived(
    cups
      .filter((cup) => cup.status === "completed" && cup.winnerId)
      .sort((a, b) => {
        // Sort by completedAt descending (most recent first)
        const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
        const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
        return dateB - dateA;
      })
  );
</script>

<div class="@container min-h-screen py-8">
  {#if loading}
    <div class="flex items-center justify-center min-h-screen">
      <div
        class="bg-white rounded-2xl border-2 border-brand-navy-500/6 shadow-md p-8"
      >
        <Loading message="Loading matches..." />
      </div>
    </div>
  {:else if groupedMatches.length === 0 && completedCupsWithWinners.length === 0}
    <div class="flex items-center justify-center min-h-screen">
      <div
        class="bg-white rounded-2xl border-2 border-brand-navy-500/6 shadow-md p-8 text-center"
      >
        <p class="text-brand-navy-700/80 text-lg">
          {#if $session.data?.user}
            No active matches to vote on right now. Check back later!
          {:else}
            <a
              href="/alpha/signup"
              class="text-secondary-500 hover:text-secondary-600 font-semibold underline"
              >Sign in</a
            > to see matches waiting for your vote.
          {/if}
        </p>
      </div>
    </div>
  {:else}
    <div class="flex flex-col gap-8">
      <!-- Active Matches Section -->
      {#if groupedMatches.length > 0}
        <div
          class="sticky top-0 z-50 py-1 @md:py-2 mb-1 px-2 sm:px-4 lg:px-8 relative"
          style="margin-left: calc(-50vw + 50%); margin-right: calc(-50vw + 50%); width: 100vw;"
        >
          <div
            class="absolute inset-0"
            style="background: linear-gradient(to top, transparent 0%, rgba(250, 249, 246, 0.75) 50%, rgba(250, 249, 246, 1) 100%); backdrop-filter: blur(28px) saturate(200%); -webkit-backdrop-filter: blur(28px) saturate(200%); mask-image: linear-gradient(to top, transparent 0%, rgba(0,0,0,0.75) 50%, black 100%); -webkit-mask-image: linear-gradient(to top, transparent 0%, rgba(0,0,0,0.75) 50%, black 100%); pointer-events: none; border-bottom: 1px solid rgba(255, 255, 255, 0.2); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.2);"
          ></div>
          <div class="max-w-md mx-auto pb-2 relative z-10">
            <PageHeader
              title="Active Matches"
              subtitle="Vote on ongoing tournaments"
              size="sm"
            />
          </div>
        </div>
      {/if}

      {#each groupedMatches as group (group.cupName + group.round)}
        <div class="flex flex-col gap-3 @md:gap-4 mt-0">
          {#if group.matches.length > 0}
            {@const cup = getCupById(group.cupId)}
            {#if cup}
              <CupHeader {cup} {purchases} {matches} />
            {/if}
          {/if}
          <div class="flex flex-col gap-3 @md:gap-4">
            {#each group.matches as match (match.id)}
              {@const cup = getCupById(match.cupId)}
              {@const project1 = getProjectById(match.project1Id)}
              {@const project2 = getProjectById(match.project2Id)}
              {@const votes1 = getMatchVotes(match.id, "project1")}
              {@const votes2 = getMatchVotes(match.id, "project2")}
              {@const totalVotes = votes1 + votes2}
              {@const percent1 =
                totalVotes > 0 ? Math.round((votes1 / totalVotes) * 100) : 50}
              {@const percent2 =
                totalVotes > 0 ? Math.round((votes2 / totalVotes) * 100) : 50}
              {@const isActive = isMatchActive(match)}
              {@const hasVoted = hasUserVotedOnMatch(match.id)}
              {@const userVotedSide = getUserVotedSide(match.id)}
              {@const userVotingWeight = getUserVotingWeight(match)}
              {@const canVote = canUserVoteOnMatch(match)}
              {@const isExpanded = expandedMatch === match.id}
              {@const roundMatches = group.matches}

              <div class="relative" data-match-id={match.id}>
                {#if isExpanded}
                  <!-- Expanded Detail View -->
                  <MatchDetail
                    {match}
                    {project1}
                    {project2}
                    {votes1}
                    {votes2}
                    {percent1}
                    {percent2}
                    {isActive}
                    {expandedVideo}
                    {votingAnimation}
                    {votes}
                    session={$session}
                    {hasVoted}
                    {userVotingWeight}
                    {userVotedSide}
                    {canVote}
                    {roundMatches}
                    {toggleVideo}
                    {voteOnMatch}
                  />
                  <button
                    onclick={() => toggleMatchExpand(match.id)}
                    class="w-full flex justify-center items-center py-2 mt-2 bg-transparent border-none cursor-pointer transition-all duration-200 text-primary-400 hover:text-secondary-500"
                    aria-label="Collapse match"
                  >
                    <svg
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      class="w-5 h-5"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                {:else}
                  <!-- Collapsed List View -->
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
                    onToggleExpand={() => toggleMatchExpand(match.id)}
                    {toggleVideo}
                    {voteOnMatch}
                  />
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/each}

      <!-- Past Champions Section -->
      {#if completedCupsWithWinners.length > 0}
        <div class="mt-16 @md:mt-20 mb-12 @md:mb-16">
          <div
            class="sticky top-0 z-50 py-2 mb-3 px-4 sm:px-6 lg:px-8 relative"
            style="margin-left: calc(-50vw + 50%); margin-right: calc(-50vw + 50%); width: 100vw;"
          >
            <div
              class="absolute inset-0"
              style="background: linear-gradient(to top, transparent 0%, rgba(250, 249, 246, 0.75) 50%, rgba(250, 249, 246, 1) 100%); backdrop-filter: blur(28px) saturate(200%); -webkit-backdrop-filter: blur(28px) saturate(200%); mask-image: linear-gradient(to top, transparent 0%, rgba(0,0,0,0.75) 50%, black 100%); -webkit-mask-image: linear-gradient(to top, transparent 0%, rgba(0,0,0,0.75) 50%, black 100%); pointer-events: none; border-bottom: 1px solid rgba(255, 255, 255, 0.2); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.2);"
            ></div>
            <div
              class="max-w-md mx-auto pb-2 relative z-10 flex flex-col items-center gap-3"
            >
              <PageHeader
                title="Previous Champions"
                subtitle="Celebrating tournament winners"
                size="sm"
              />
              <button
                onclick={() => (championsExpanded = !championsExpanded)}
                onkeydown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    championsExpanded = !championsExpanded;
                  }
                }}
                class="flex items-center justify-center w-10 h-10 rounded-full bg-primary-500 text-white hover:bg-primary-600 transition-colors shadow-lg hover:shadow-xl cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                aria-label={championsExpanded
                  ? "Collapse Previous Champions"
                  : "Expand Previous Champions"}
                aria-expanded={championsExpanded}
              >
                <Icon
                  name={championsExpanded
                    ? "mdi:chevron-up"
                    : "mdi:chevron-down"}
                  size="lg"
                  color="white"
                />
              </button>
            </div>
          </div>
          {#if championsExpanded}
            <div
              class="grid grid-cols-1 @md:grid-cols-[repeat(auto-fit,minmax(500px,1fr))] @lg:grid-cols-[repeat(auto-fit,minmax(700px,1fr))] gap-6 @md:gap-8 @lg:gap-10 max-w-7xl mx-auto w-full"
            >
              {#each completedCupsWithWinners as cup}
                {@const winnerProject = projects.find(
                  (p) => p.id === cup.winnerId
                )}
                {#if winnerProject}
                  <WinnerCard {cup} {winnerProject} />
                {/if}
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>
