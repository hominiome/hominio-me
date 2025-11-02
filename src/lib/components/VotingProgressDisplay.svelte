<script lang="ts">
  import { onMount } from "svelte";
  import { getUserProfile } from "$lib/userProfileCache";

  let {
    matchId,
    projectSide,
    votesReceived = 0,
    notificationIcon,
  } = $props<{
    matchId: string;
    projectSide: "project1" | "project2";
    votesReceived?: number; // Votes received in THIS event (positive if voted for, negative if voted against)
    notificationIcon?: string; // Icon name to determine color (mdi:thumb-up or mdi:thumb-down)
  }>();

  let project1Votes = $state<number>(0);
  let project2Votes = $state<number>(0);
  let project1 = $state<any>(null);
  let project2 = $state<any>(null);
  let founder1Profile = $state<{
    name: string | null;
    image: string | null;
  } | null>(null);
  let founder2Profile = $state<{
    name: string | null;
    image: string | null;
  } | null>(null);
  let loading = $state(true);

  onMount(async () => {
    try {
      // Fetch match details and vote data in parallel
      const [matchResponse, voteResponse] = await Promise.all([
        fetch(`/alpha/api/match-details/${matchId}`),
        fetch(`/alpha/api/match-vote-data/${matchId}`),
      ]);

      if (matchResponse.ok) {
        const matchData = await matchResponse.json();
        project1 = matchData.project1;
        project2 = matchData.project2;

        // Fetch founder profiles for both projects
        if (project1?.userId) {
          const profile1 = await getUserProfile(project1.userId);
          founder1Profile = { name: profile1.name, image: profile1.image };
        }
        if (project2?.userId) {
          const profile2 = await getUserProfile(project2.userId);
          founder2Profile = { name: profile2.name, image: profile2.image };
        }
      }

      if (voteResponse.ok) {
        const voteData = await voteResponse.json();
        project1Votes = Number(voteData.project1 || 0);
        project2Votes = Number(voteData.project2 || 0);
        console.log("Vote data:", { project1Votes, project2Votes, matchId });
      }
    } catch (error) {
      console.error("Failed to fetch voting progress data:", error);
    } finally {
      loading = false;
    }
  });

  const totalVotes = $derived(project1Votes + project2Votes);

  // Calculate percentages - if no votes, show 50/50, otherwise calculate correctly
  const percent1 = $derived(
    totalVotes > 0 ? (project1Votes / totalVotes) * 100 : 50
  );
  const percent2 = $derived(
    totalVotes > 0 ? (project2Votes / totalVotes) * 100 : 50
  );

  // Round to 1 decimal place to match MatchDetail
  const normalizedPercent1 = $derived(Math.round(percent1 * 10) / 10);
  const normalizedPercent2 = $derived(Math.round(percent2 * 10) / 10);

  // Debug logging
  $effect(() => {
    if (!loading && project1 && project2) {
      console.log("Vote data:", {
        project1Votes,
        project2Votes,
        totalVotes,
        percent1: normalizedPercent1,
        percent2: normalizedPercent2,
        calculatedPercent1: percent1,
        calculatedPercent2: percent2,
      });
    }
  });

  // Determine if this is a thumb-up (positive vote) or thumb-down (negative vote)
  const isThumbUp = notificationIcon === "mdi:thumb-up";
  const isThumbDown = notificationIcon === "mdi:thumb-down";

  // Color vote count buttons based on thumb icon
  // Yellow (#f4d03f) for thumb-up, Teal (#4ecdc4) for thumb-down
  const project1ColorClass =
    projectSide === "project1"
      ? isThumbUp
        ? "vote-count-yellow"
        : isThumbDown
          ? "vote-count-teal"
          : ""
      : "";
  const project2ColorClass =
    projectSide === "project2"
      ? isThumbUp
        ? "vote-count-yellow"
        : isThumbDown
          ? "vote-count-teal"
          : ""
      : "";
</script>

{#if !loading && project1 && project2}
  <div class="voting-progress-display">
    <!-- Both project cards side by side -->
    <div class="projects-grid-compact">
      <!-- Project 1 Card -->
      <div class="project-card-compact project-card-yellow">
        <div class="project-header-compact">
          {#if (project1?.profileImageUrl && project1.profileImageUrl.trim()) || founder1Profile?.image}
            {@const project1ImageUrl = project1?.profileImageUrl && project1.profileImageUrl.trim() ? project1.profileImageUrl.trim() : (founder1Profile?.image || null)}
            <img
              src={project1ImageUrl}
              alt={founder1Profile.name || "Founder"}
              class="founder-avatar-compact"
              onerror={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          {:else}
            <div class="founder-avatar-placeholder-compact project-card-yellow">
              {founder1Profile?.name?.[0]?.toUpperCase() || "?"}
            </div>
          {/if}
          <div class="project-info-compact">
            <h3 class="project-title-compact">{project1.title}</h3>
            <p class="founder-name-compact">
              {founder1Profile?.name || "Unknown"}
            </p>
          </div>
        </div>
      </div>

      <!-- Project 2 Card -->
      <div class="project-card-compact project-card-teal">
        <div class="project-header-compact">
          {#if (project2?.profileImageUrl && project2.profileImageUrl.trim()) || founder2Profile?.image}
            {@const project2ImageUrl = project2?.profileImageUrl && project2.profileImageUrl.trim() ? project2.profileImageUrl.trim() : (founder2Profile?.image || null)}
            <img
              src={project2ImageUrl}
              alt={founder2Profile.name || "Founder"}
              class="founder-avatar-compact"
              onerror={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          {:else}
            <div class="founder-avatar-placeholder-compact project-card-teal">
              {founder2Profile?.name?.[0]?.toUpperCase() || "?"}
            </div>
          {/if}
          <div class="project-info-compact">
            <h3 class="project-title-compact">{project2.title}</h3>
            <p class="founder-name-compact">
              {founder2Profile?.name || "Unknown"}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Progress Bar with Vote Counts and Percentages (exact match from MatchDetail.svelte) -->
    <div class="progress-bar-wrapper">
      <!-- Vote count left -->
      <div class="vote-count-inline vote-count-left vote-count-square">
        <span class="count-number">{project1Votes || 0}</span>
      </div>

      <div class="progress-bar-container">
        <div class="progress-bar-yellow" style="width: {normalizedPercent1}%">
          {#if normalizedPercent1 >= 5}
            <span class="progress-percent"
              >{normalizedPercent1.toFixed(1)}%</span
            >
          {/if}
        </div>
        <div class="progress-bar-teal" style="width: {normalizedPercent2}%">
          {#if normalizedPercent2 >= 5}
            <span class="progress-percent"
              >{normalizedPercent2.toFixed(1)}%</span
            >
          {/if}
        </div>
      </div>

      <!-- Vote count right -->
      <div class="vote-count-inline vote-count-right vote-count-square">
        <span class="count-number">{project2Votes || 0}</span>
      </div>
    </div>

    <!-- Votes received in this event -->
    <div class="vote-difference">
      <div class="vote-badge-wrapper">
        {#if votesReceived > 0}
          <span class="vote-sign positive">+</span>
          <span class="vote-number positive">{Math.abs(votesReceived)}</span>
        {:else if votesReceived < 0}
          <span class="vote-sign negative">-</span>
          <span class="vote-number negative">{Math.abs(votesReceived)}</span>
        {:else}
          <span class="vote-sign neutral">=</span>
          <span class="vote-number neutral">0</span>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .voting-progress-display {
    width: 100%;
    padding: 1rem;
    background: #f8f9fa;
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .projects-grid-compact {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  .project-card-compact {
    background: white;
    border-radius: 12px;
    padding: 0.75rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  }

  .project-card-yellow {
    border-top: 3px solid #f4d03f;
  }

  .project-card-teal {
    border-top: 3px solid #4ecdc4;
  }

  .project-header-compact {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .founder-avatar-compact,
  .founder-avatar-placeholder-compact {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .founder-avatar-compact {
    object-fit: cover;
    border: 2px solid #f4d03f;
  }

  .founder-avatar-placeholder-compact {
    background: linear-gradient(135deg, #1a1a4e 0%, #2a2a6e 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 700;
    font-size: 1rem;
    border: 2px solid #f4d03f;
  }

  .project-card-teal .founder-avatar-compact,
  .project-card-teal .founder-avatar-placeholder-compact {
    border-color: #4ecdc4;
  }

  .project-info-compact {
    flex: 1;
    min-width: 0;
  }

  .project-title-compact {
    color: #1a1a4e;
    font-size: 1rem;
    font-weight: 800;
    line-height: 1.2;
    margin: 0 0 0.25rem 0;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .founder-name-compact {
    color: rgba(26, 26, 78, 0.6);
    font-weight: 500;
    font-size: 0.75rem;
    margin: 0;
  }

  .progress-bar-wrapper {
    display: flex;
    align-items: stretch; /* Stretch to remove gaps */
    gap: 0;
    position: relative;
    margin-bottom: 0; /* No margin between progress bar and voters */
  }

  .progress-bar-container {
    height: 60px;
    display: flex;
    flex: 1;
    position: relative;
    overflow: hidden; /* Ensure no gaps between progress segments */
  }

  .progress-bar-yellow {
    height: 100%;
    background: linear-gradient(
      90deg,
      rgba(244, 208, 63, 0.25) 0%,
      rgba(244, 208, 63, 0.15) 100%
    );
    transition: width 0.1s ease-in-out; /* Fast default transition */
    display: flex;
    align-items: center;
    justify-content: center;
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    transform-origin: left center; /* Flow from left */
    min-width: 0; /* Allow shrinking to 0% smoothly */
    z-index: 1;
  }

  .progress-bar-teal {
    height: 100%;
    background: linear-gradient(
      90deg,
      rgba(78, 205, 196, 0.15) 0%,
      rgba(78, 205, 196, 0.25) 100%
    );
    transition: width 0.1s ease-in-out; /* Fast default transition */
    display: flex;
    align-items: center;
    justify-content: center;
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    transform-origin: right center; /* Flow from right */
    min-width: 0; /* Allow shrinking to 0% smoothly */
    z-index: 2;
  }

  /* Ensure both bars are always visible during transition */
  .progress-bar-container .progress-bar-yellow,
  .progress-bar-container .progress-bar-teal {
    overflow: visible; /* Don't clip during transition */
  }

  .progress-percent {
    font-size: 1.5rem;
    font-weight: 800;
    color: #1a1a4e;
    white-space: nowrap;
    position: relative;
    z-index: 10;
    pointer-events: none;
  }

  .progress-bar-yellow .progress-percent {
    color: #b8860b; /* Darker yellow */
  }

  .progress-bar-teal .progress-percent {
    color: #1e8b85; /* Darker teal */
  }

  .vote-count-inline {
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 900;
    font-size: 1.75rem;
    flex-shrink: 0;
  }

  /* 16:9 vote count - same aspect ratio as button, replaces button when voted */
  .vote-count-square {
    height: 60px;
    width: 95px; /* 16:9 aspect ratio, slightly reduced */
    padding: 0;
  }

  .vote-count-left {
    background: linear-gradient(
      90deg,
      rgba(244, 208, 63, 0.55) 0%,
      rgba(244, 208, 63, 0.45) 100%
    );
    color: #b8860b; /* Darker yellow */
    border-radius: 12px 0 0 12px; /* Rounded left corners */
  }

  .vote-count-right {
    background: linear-gradient(
      90deg,
      rgba(78, 205, 196, 0.45) 0%,
      rgba(78, 205, 196, 0.55) 100%
    );
    color: #1e8b85; /* Darker teal */
    border-radius: 0 12px 12px 0; /* Rounded right corners */
  }

  .count-number {
    font-weight: 900;
    letter-spacing: -0.02em;
  }

  .vote-difference {
    display: flex;
    align-items: center;
    justify-content: center;
    padding-top: 0.5rem;
  }

  .vote-badge-wrapper {
    display: inline-flex;
    align-items: baseline;
    gap: 0.25rem;
    padding: 0.5rem 1rem;
    background: rgba(255, 255, 255, 0.6);
    border-radius: 999px;
    backdrop-filter: blur(8px);
  }

  .vote-sign {
    font-size: 2rem;
    font-weight: 900;
    line-height: 1;
  }

  .vote-number {
    font-size: 2.5rem;
    font-weight: 900;
    line-height: 1;
  }

  .vote-sign.positive,
  .vote-number.positive {
    color: #4ecdc4;
  }

  .vote-sign.negative,
  .vote-number.negative {
    color: #f87171;
  }

  .vote-sign.neutral,
  .vote-number.neutral {
    color: #1a1a4e;
    opacity: 0.6;
  }

  @media (max-width: 768px) {
    .voting-progress-display {
      padding: 0.875rem;
      gap: 0.625rem;
    }

    .project-header-compact {
      gap: 0.625rem;
    }

    .founder-avatar-compact,
    .founder-avatar-placeholder-compact {
      width: 36px;
      height: 36px;
      font-size: 0.875rem;
    }

    .project-title-compact {
      font-size: 0.875rem;
    }

    .founder-name-compact {
      font-size: 0.7rem;
    }

    .progress-bar-wrapper {
      flex-wrap: nowrap; /* Keep stats in one row */
      gap: 0; /* No gap - elements flush together */
    }

    .progress-bar-container {
      height: 50px;
      flex: 1; /* Take remaining space */
      min-width: 0; /* Allow shrinking */
      order: 0; /* Natural order - between vote counts */
    }

    .vote-count-inline {
      font-size: 1rem; /* Smaller font */
      flex-shrink: 0; /* Don't shrink */
    }

    .vote-count-square {
      height: 50px;
      width: 80px; /* 16:9 aspect ratio, slightly reduced */
      padding: 0;
    }

    .vote-count-left {
      order: -1; /* After left button, before progress bar */
    }

    .vote-count-right {
      order: 1; /* After progress bar, before right button */
    }

    .progress-percent {
      font-size: 0.875rem;
    }

    .vote-sign {
      font-size: 1.75rem;
    }

    .vote-number {
      font-size: 2rem;
    }
  }
</style>
