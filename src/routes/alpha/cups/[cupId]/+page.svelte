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
  import CupHeader from "$lib/CupHeader.svelte";
  import {
    allProjects,
    purchasesByCup,
    identitiesByUser,
    allVotes,
    votesByUser,
    cupById,
    matchesByCup,
  } from "$lib/synced-queries";
  import { Card } from "$lib/design-system/molecules";
  import Button from "$lib/design-system/atoms/Button.svelte";
  import Icon from "$lib/design-system/atoms/Icon.svelte";

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
      const cupQuery = cupById(cupId);
      cupView = zero.materialize(cupQuery);

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

          // Check if cup or its matches have expired and close them
          try {
            await fetch(`/alpha/api/check-expiry?cupId=${cupId}`, {
              method: "GET",
            });
          } catch (error) {
            console.warn("Failed to check expiry:", error);
          }

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
      const projectsQuery = allProjects();
      projectsView = zero.materialize(projectsQuery);

      projectsView.addListener((data) => {
        projects = Array.from(data);
      });

      // Query cup matches using synced query
      const matchesQuery = matchesByCup(cupId);
      matchesView = zero.materialize(matchesQuery);

      matchesView.addListener(async (data) => {
        matches = Array.from(data);

        // Check if any matches have expired and close them
        try {
          await fetch(`/alpha/api/check-expiry?cupId=${cupId}`, {
            method: "GET",
          });
        } catch (error) {
          console.warn("Failed to check expiry:", error);
        }
      });

      // Query all votes for vote counts and voter display using synced query
      const votesQuery = allVotes();
      votesView = zero.materialize(votesQuery);

      votesView.addListener((data) => {
        votes = Array.from(data);
      });

      // Query identity purchases for this cup for prize pool calculation using synced query
      const purchasesQuery = purchasesByCup(cupId);
      purchasesView = zero.materialize(purchasesQuery);

      purchasesView.addListener((data) => {
        purchases = Array.from(data);
      });

      // Query user's identity and votes if logged in
      let userIdentityView;
      let userVotesView;

      if ($session.data?.user) {
        const userId = $session.data.user.id;

        // Query user's identities (all identities are universal)
        const userIdentityQuery = identitiesByUser(userId);
        userIdentityView = zero.materialize(userIdentityQuery);

        userIdentityView.addListener((data) => {
          const identities = Array.from(data);
          if (identities.length > 0) {
            // Get the identity with highest voting weight
            userIdentity = identities.reduce((prev, curr) => 
              (curr.votingWeight > prev.votingWeight) ? curr : prev
            );
          } else {
            userIdentity = null;
          }
        });

        // Query user's votes to check which matches they've voted on using synced query
        const userVotesQuery = votesByUser(userId);
        userVotesView = zero.materialize(userVotesQuery);

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

<div class="min-h-screen p-2 sm:p-4 md:p-8">
  <div class="max-w-7xl mx-auto">
    {#if loading}
      <Card class="p-8 text-center">
        {#snippet children()}
          <p class="text-primary-700/70">Loading cup...</p>
        {/snippet}
      </Card>
    {:else if cup}
      <!-- Action Buttons -->
      <div class="mb-4 md:mb-6 flex justify-end">
        <div class="flex flex-col sm:flex-row gap-2 md:gap-3">
          {#if isCreator}
            <Button
              variant="primary"
              onclick={() => goto(`/alpha/cups/${cupId}/admin`)}
              class="!w-full sm:!w-auto"
            >
              Admin Panel
            </Button>
          {/if}
          {#if isCreator || isAdmin}
            <Button
              variant="secondary"
              onclick={() => {
                const url = new URL($page.url);
                url.searchParams.set("modal", "edit-cup");
                url.searchParams.set("cupId", cupId);
                goto(`/alpha/cups?${url.searchParams.toString()}`);
              }}
              class="!w-full sm:!w-auto"
            >
              Edit
            </Button>
          {/if}
        </div>
      </div>

      <!-- Cup Header - Reusing component from live page -->
      <CupHeader {cup} purchases={purchases} {matches} />

      <!-- Matches by Round -->
      {#if matches.length === 0}
        <Card class="p-12 text-center">
          {#snippet children()}
            <h2 class="text-3xl font-bold text-primary-500 mb-4">
              No Matches Yet
            </h2>
            <p class="text-primary-700/60">
              {#if isCreator}
                Go to the admin panel to set up the tournament.
              {:else}
                The cup creator hasn't set up matches yet.
              {/if}
            </p>
          {/snippet}
        </Card>
      {:else}
        <div class="space-y-6 @md:space-y-8">
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
                <div class="round-section">
                  <Card class="pt-5 pb-6 px-6 md:pt-6 md:pb-7 md:px-12 mb-4 md:mb-6">
                    {#snippet children()}
                      <h2 class="text-base md:text-lg font-extrabold text-primary-500 m-0 pt-1 md:pt-2 pb-3 md:pb-4 border-b-[3px] border-primary-500/8 tracking-tight relative">
                        {getRoundLabel(round)}
                        <span class="absolute bottom-[-3px] left-0 w-[60px] md:w-[80px] h-[3px] bg-gradient-to-r from-secondary-500 to-transparent rounded-sm"></span>
                      </h2>
                    {/snippet}
                  </Card>
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
  /* Round section - wrapper for header card and matches */
  .round-section {
    margin-bottom: 1.5rem;
  }

  @media (min-width: 768px) {
    .round-section {
      margin-bottom: 2rem;
    }
  }


  /* Round matches - standalone, no card wrapper */
  .round-matches {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  @media (min-width: 768px) {
    .round-matches {
      gap: 0.875rem;
    }
  }
</style>




