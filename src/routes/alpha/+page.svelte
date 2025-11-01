<script>
  import { onMount } from "svelte";
  import { authClient } from "$lib/auth.client.js";
  import { goto } from "$app/navigation";
  import { useZero } from "$lib/zero-utils";
  import { getUserProfile } from "$lib/userProfileCache";
  import MatchDetail from "$lib/MatchDetail.svelte";
  import MatchListItem from "$lib/MatchListItem.svelte";
  import { showError, showInfo } from "$lib/toastStore.js";

  const zeroContext = useZero();
  const session = authClient.useSession();

  let zero = null;
  let cups = $state([]);
  let projects = $state([]);
  let allMatches = $state([]); // All matches from database
  let votes = $state([]);
  let userIdentity = $state(null);
  let userVotes = $state([]);
  let loading = $state(true);
  let voting = $state(false);
  let votingAnimation = $state(null);
  let expandedVideo = $state(null);
  let expandedMatch = $state(null);
  let votingSound = $state(null); // Preloaded audio instance

  // Filter and group active matches by cup and round
  let groupedMatches = $derived.by(() => {
    console.log("🟨 GROUPED MATCHES DERIVED RUNNING:", {
      allMatchesCount: allMatches.length,
      cupsCount: cups.length,
      timestamp: new Date().toISOString(),
    });

    // If no matches or cups, return empty
    if (allMatches.length === 0 || cups.length === 0) {
      console.log("⚠️ No matches or cups yet, returning empty");
      return [];
    }

    const groups = new Map();

    // Filter to only active matches - debug logging
    console.log("🔍 Starting to filter matches...");
    console.log(
      "🔍 All matches:",
      allMatches.map((m) => ({
        id: m.id,
        status: m.status,
        round: m.round,
        cupId: m.cupId,
      }))
    );
    console.log(
      "🔍 All cups:",
      cups.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        currentRound: c.currentRound,
      }))
    );

    const activeMatches = [];
    for (const match of allMatches) {
      const isActive = isMatchActive(match);
      console.log(
        `🔍 Match ${match.id}: status=${match.status}, round=${match.round}, isActive=${isActive}`
      );
      if (isActive) {
        activeMatches.push(match);
      }
    }

    console.log("✅ FILTERED MATCHES RESULT:", {
      totalMatches: allMatches.length,
      activeMatches: activeMatches.length,
      allMatchStatuses: [...new Set(allMatches.map((m) => m.status))],
      cupsLoaded: cups.length,
      activeMatchIds: activeMatches.map((m) => m.id),
    });

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
    const roundOrder = { round_16: 1, quarter: 2, semi: 3, final: 4 };
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
      console.log("⏳ Waiting for Zero to be ready...");
      while (!zeroContext.isReady() || !zeroContext.getInstance()) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      zero = zeroContext.getInstance();
      console.log("✅ Zero is ready!");

      // Query all cups (we need all cups to check match status, not just active ones)
      const cupsQuery = zero.query.cup;
      cupsView = cupsQuery.materialize();

      cupsView.addListener((data) => {
        cups = Array.from(data);
        console.log("🟦 CUPS LOADED:", {
          count: cups.length,
          cups: cups.map((c) => ({
            id: c.id,
            name: c.name,
            status: c.status,
            currentRound: c.currentRound,
          })),
        });
        // Set loading to false once we have the cups data (even if empty)
        loading = false;
      });

      // Query all projects
      const projectsQuery = zero.query.project;
      projectsView = projectsQuery.materialize();

      projectsView.addListener((data) => {
        projects = Array.from(data);
      });

      // Query all matches (filtering happens reactively in $derived)
      const matchesQuery = zero.query.cupMatch.orderBy("position", "asc");
      matchesView = matchesQuery.materialize();

      matchesView.addListener((data) => {
        // Store all matches - filtering by active cups happens reactively
        allMatches = Array.from(data);
        console.log("🟩 MATCHES LOADED:", {
          count: allMatches.length,
          matches: allMatches.map((m) => ({
            id: m.id,
            cupId: m.cupId,
            status: m.status,
            round: m.round,
            project1Id: m.project1Id,
            project2Id: m.project2Id,
          })),
          statuses: [...new Set(allMatches.map((m) => m.status))],
        });
      });

      // Query all votes for vote counts
      const votesQuery = zero.query.vote;
      votesView = votesQuery.materialize();

      votesView.addListener((data) => {
        votes = Array.from(data);
      });

      // Query user's identity and votes if logged in
      let userIdentityView;
      let userVotesView;

      if ($session.data?.user) {
        const userId = $session.data.user.id;

        // Query user's identity
        const userIdentityQuery = zero.query.userIdentities.where(
          "userId",
          "=",
          userId
        );
        userIdentityView = userIdentityQuery.materialize();

        userIdentityView.addListener((data) => {
          const identities = Array.from(data);
          if (identities.length > 0) {
            userIdentity = identities[0];
          } else {
            userIdentity = null;
          }
        });

        // Query user's votes
        const userVotesQuery = zero.query.vote.where("userId", "=", userId);
        userVotesView = userVotesQuery.materialize();

        userVotesView.addListener((data) => {
          userVotes = Array.from(data);
        });
      }

      return () => {
        if (cupsView) cupsView.destroy();
        if (projectsView) projectsView.destroy();
        if (matchesView) matchesView.destroy();
        if (votesView) votesView.destroy();
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
      case "round_16":
        return "Round of 16";
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

  function toggleMatchExpand(matchId) {
    if (expandedMatch === matchId) {
      expandedMatch = null;
    } else {
      expandedMatch = matchId;
    }
  }

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

    // Check if user has an identity
    if (!userIdentity) {
      goto("/alpha/purchase");
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
    const match = allMatches.find((m) => m.id === matchId);
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
    const cup = getCupById(match.cupId);

    // Always return true for voting status
    if (match.status === "voting") {
      console.log("✅ Match is voting:", match.id, "cup found:", !!cup);
      return true;
    }

    // Check pending matches
    if (match.status === "pending") {
      const cupActive = cup?.status === "active";
      const matchInCurrentRound = cup?.currentRound === match.round;
      const shouldBeActive = cupActive && matchInCurrentRound;

      console.log("⏳ Pending match check:", {
        matchId: match.id,
        matchRound: match.round,
        cupFound: !!cup,
        cupId: cup?.id,
        cupName: cup?.name,
        cupStatus: cup?.status,
        cupCurrentRound: cup?.currentRound,
        cupActive,
        matchInCurrentRound,
        shouldBeActive,
      });

      if (shouldBeActive) {
        return true;
      }
    }

    console.log("❌ Match NOT active:", {
      id: match.id,
      status: match.status,
      cupFound: !!cup,
      cupStatus: cup?.status,
      cupCurrentRound: cup?.currentRound,
      matchRound: match.round,
    });
    return false;
  }
</script>

<div class="alpha-timeline-container">
  <div class="alpha-header">
    <h1 class="alpha-title">Active Matches</h1>
  </div>

  {#if loading}
    <div class="loading-state">
      <p>Loading matches...</p>
    </div>
  {:else if groupedMatches.length === 0}
    <div class="empty-state">
      <p class="empty-message">
        {#if $session.data?.user}
          No active matches to vote on right now. Check back later!
          <br />
          <small
            style="color: #999; font-size: 0.875rem; margin-top: 0.5rem; display: block;"
          >
            Debug: {allMatches.length} matches loaded, {cups.length} cups loaded,
            {groupedMatches.length} groups
            <br />
            Match statuses: {[...new Set(allMatches.map((m) => m.status))].join(
              ", "
            )}
            <br />
            Cup statuses: {[...new Set(cups.map((c) => c.status))].join(", ")}
          </small>
        {:else}
          <a href="/alpha/signup" class="link">Sign in</a> to see matches waiting
          for your vote.
        {/if}
      </p>
    </div>
  {:else}
    <div class="timeline">
      <!-- Debug info -->
      {#each groupedMatches as group (group.cupName + group.round)}
        <div class="match-group">
          <div class="group-header">
            <h3 class="group-title">{group.cupName}</h3>
            <span class="group-round">{getRoundLabel(group.round)}</span>
          </div>
          <div class="group-matches">
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
              {@const userVotingWeight = getUserVotingWeight()}
              {@const canVote = canUserVoteOnMatch(match)}
              {@const isExpanded = expandedMatch === match.id}

              <div class="timeline-item">
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
                    {toggleVideo}
                    {voteOnMatch}
                  />
                  <button
                    onclick={() => toggleMatchExpand(match.id)}
                    class="collapse-button"
                    aria-label="Collapse match"
                  >
                    <svg
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      class="collapse-icon"
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
    </div>
  {/if}
</div>

<style>
  .alpha-timeline-container {
    min-height: 100vh;
    padding: 2rem;
    max-width: 1200px;
    margin: 0 auto;
    background: linear-gradient(135deg, #f0fffe 0%, #fff9e6 100%);
  }

  .alpha-header {
    text-align: center;
    margin-bottom: 3rem;
  }

  .alpha-title {
    font-size: 2rem;
    font-weight: 700;
    color: #111827;
    margin: 0;
    letter-spacing: -0.02em;
  }

  .loading-state,
  .empty-state {
    text-align: center;
    padding: 4rem 2rem;
  }

  .empty-message {
    font-size: 1.125rem;
    color: #6b7280;
  }

  .link {
    color: #4fc3c3;
    text-decoration: none;
    font-weight: 600;
  }

  .link:hover {
    text-decoration: underline;
  }

  .timeline {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .match-group {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .group-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1rem;
    background: rgba(255, 255, 255, 0.8);
    border-radius: 12px;
    border: 1px solid rgba(26, 26, 78, 0.1);
  }

  .group-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: #1a1a4e;
    margin: 0;
  }

  .group-round {
    font-size: 0.875rem;
    color: #4ecdc4;
    font-weight: 600;
    padding: 0.25rem 0.75rem;
    background: rgba(78, 205, 196, 0.1);
    border-radius: 6px;
  }

  .group-matches {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding-left: 1rem;
  }

  .timeline-item {
    position: relative;
  }

  .collapse-button {
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 0.5rem;
    margin-top: 0.5rem;
    background: none;
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
    color: rgba(26, 26, 78, 0.4);
  }

  .collapse-button:hover {
    color: #4ecdc4;
  }

  .collapse-icon {
    width: 20px;
    height: 20px;
  }

  @media (max-width: 768px) {
    .alpha-timeline-container {
      padding: 1rem;
    }

    .alpha-title {
      font-size: 1.5rem;
    }

    .timeline {
      gap: 1rem;
    }
  }
</style>
