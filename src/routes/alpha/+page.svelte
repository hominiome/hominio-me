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

  // Show all matches (for debugging - no filtering)
  let activeMatches = $derived(() => {
    return allMatches;
  });

  onMount(() => {
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

      // Query all active cups
      const cupsQuery = zero.query.cup.where("status", "=", "active");
      cupsView = cupsQuery.materialize();

      cupsView.addListener((data) => {
        cups = Array.from(data);
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

    // Trigger animation
    votingAnimation = `${matchId}-${projectSide}`;
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
    return match.status === "voting";
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
  {:else if allMatches.length === 0}
    <div class="empty-state">
      <p class="empty-message">
        {#if $session.data?.user}
          No matches found.
        {:else}
          <a href="/alpha/signup" class="link">Sign in</a> to see matches waiting
          for your vote.
        {/if}
      </p>
    </div>
  {:else}
    <div class="timeline">
      {#each allMatches as match (match.id)}
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
              session={$session.data}
              {hasVoted}
              {userVotingWeight}
              {userVotedSide}
              {toggleVideo}
              {voteOnMatch}
            />
            <button
              onclick={() => toggleMatchExpand(match.id)}
              class="collapse-button"
            >
              Collapse
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
              onToggleExpand={() => toggleMatchExpand(match.id)}
              {toggleVideo}
              {voteOnMatch}
            />
          {/if}
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
    gap: 1.5rem;
  }

  .timeline-item {
    position: relative;
  }

  .collapse-button {
    width: 100%;
    padding: 0.75rem;
    margin-top: 0.5rem;
    background: white;
    border: 2px solid #e5e7eb;
    border-radius: 12px;
    font-size: 0.938rem;
    font-weight: 600;
    color: #6b7280;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .collapse-button:hover {
    border-color: #4fc3c3;
    color: #4fc3c3;
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
