<script>
  import MatchDetail from "$lib/MatchDetail.svelte";

  let {
    match,
    project1,
    project2,
    votes1,
    votes2,
    percent1,
    percent2,
    isActive,
    expandedMatch,
    expandedVideo,
    votingAnimation,
    votes = [], // Array of vote records
    session,
    getRoundLabel,
    hasVoted = false,
    userVotingWeight = 0,
    userVotedSide = null,
    canVote = true, // Whether user can vote (not owner of either project)
    onToggleExpand,
    toggleVideo,
    voteOnMatch,
    roundMatches = [], // All matches in the same round (for fallback endDate)
  } = $props();
</script>

<!-- Compact Match List Item -->
{#if expandedMatch !== match.id}
  <button
    onclick={onToggleExpand}
    class="match-list-item"
    class:voted-match={hasVoted && isActive}
  >
    <!-- Left: Project 1 -->
    <div class="match-list-project-left">
      <span
        class="team-list-name"
        class:winner-text={match.winnerId === match.project1Id}
      >
        {project1?.title || "TBD"}
      </span>
    </div>

    <!-- Center: Scores with Status Indicator -->
    <div class="match-list-center">
      <span class="team-list-votes">{votes1}</span>
      <!-- Match State Indicator - centered between scores -->
      <div class="match-list-indicator">
        {#if match.winnerId}
          <svg
            class="status-icon completed"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        {:else if isActive}
          <svg
            class="status-icon pending"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <circle cx="12" cy="12" r="6" />
          </svg>
        {:else}
          <svg
            class="status-icon waiting"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M8 7h8M8 12h8M8 17h4"
            />
          </svg>
        {/if}
      </div>
      <span class="team-list-votes">{votes2}</span>
    </div>

    <!-- Right: Project 2 -->
    <div class="match-list-project-right">
      <span
        class="team-list-name"
        class:winner-text={match.winnerId === match.project2Id}
      >
        {project2?.title || "TBD"}
      </span>
    </div>
  </button>
{/if}

<!-- Collapsible Match Detail -->
{#if expandedMatch === match.id}
  <div class="match-detail-expanded">
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
      {session}
      {hasVoted}
      {userVotingWeight}
      {userVotedSide}
      {canVote}
      {toggleVideo}
      {voteOnMatch}
    />
    <button
      onclick={onToggleExpand}
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
  </div>
{/if}

<style>
  /* Compact Match List */
  .match-list-item {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 1rem 1.5rem;
    padding: 0.75rem 1.5rem;
    background: white;
    border: 2px solid rgba(26, 26, 78, 0.08);
    border-radius: 20px;
    cursor: pointer;
    transition: all 0.2s;
    width: 100%;
    position: relative;
  }

  @media (max-width: 768px) {
    .match-list-item {
      grid-template-columns: 1fr auto 1fr;
      gap: 0.5rem 0.5rem;
      padding: 0.625rem 0.75rem;
      /* Prevent grid from collapsing - keep side-by-side layout */
      min-width: 0; /* Allow grid to shrink but maintain structure */
    }

    /* Keep opponents side-by-side on mobile */
    .match-list-project-left {
      max-width: 120px; /* Limit width but allow ellipsis */
    }

    .match-list-project-right {
      max-width: 120px; /* Limit width but allow ellipsis */
      text-align: right; /* Keep right alignment */
    }

    .match-list-center {
      justify-self: center;
      gap: 0.2rem; /* Reduce gap on mobile */
    }

    .team-list-name {
      font-size: 0.75rem;
      max-width: 100%;
    }

    .team-list-votes {
      padding: 0.25rem 0.5rem;
      font-size: 0.75rem;
      min-width: 28px;
    }

    .match-list-indicator {
      width: 12px;
      height: 12px;
      flex-shrink: 0;
    }

    .status-icon {
      width: 10px;
      height: 10px;
    }
  }

  @media (max-width: 480px) {
    .match-list-item {
      gap: 0.375rem 0.375rem;
      padding: 0.5rem 0.625rem;
    }

    .match-list-project-left,
    .match-list-project-right {
      max-width: 90px; /* Even smaller on very small screens */
    }

    .team-list-name {
      font-size: 0.6875rem;
    }

    .team-list-votes {
      padding: 0.25rem 0.375rem;
      font-size: 0.7rem;
      min-width: 24px;
    }

    .match-list-center {
      gap: 0.15rem;
    }

    .match-list-indicator {
      width: 10px;
      height: 10px;
    }

    .status-icon {
      width: 8px;
      height: 8px;
    }
  }

  .match-list-item:hover {
    border-color: rgba(78, 205, 196, 0.3);
    box-shadow: 0 4px 16px rgba(78, 205, 196, 0.15);
    transform: translateY(-2px);
  }

  /* Styling for voted matches - make them less prominent */
  .match-list-item.voted-match {
    opacity: 0.85;
    background: rgba(255, 255, 255, 0.9);
    border-color: rgba(26, 26, 78, 0.1);
  }

  .match-list-item.voted-match:hover {
    opacity: 0.75;
    border-color: rgba(78, 205, 196, 0.15);
    box-shadow: 0 2px 8px rgba(78, 205, 196, 0.08);
    transform: translateY(-1px);
  }

  .match-list-item.voted-match .team-list-name {
    color: rgba(26, 26, 78, 0.5);
  }

  .match-list-item.voted-match .team-list-votes {
    background: rgba(26, 26, 78, 0.04);
    color: rgba(26, 26, 78, 0.5);
  }


  /* Left: Project 1 */
  .match-list-project-left {
    text-align: left;
    justify-self: start;
    min-width: 0; /* Allow flex shrinking */
    overflow: hidden;
  }

  /* Center: Scores with Status Indicator */
  .match-list-center {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    justify-self: center;
    flex-shrink: 0; /* Prevent scores from shrinking */
  }

  /* Right: Project 2 */
  .match-list-project-right {
    text-align: right;
    justify-self: end;
    min-width: 0; /* Allow flex shrinking */
    overflow: hidden;
  }

  /* Match State Indicator - centered below VS */
  .match-list-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  .team-list-name {
    font-weight: 600;
    color: #1a1a4e;
    font-size: 0.875rem;
    white-space: nowrap; /* Prevent line breaks */
    overflow: hidden;
    text-overflow: ellipsis;
    display: block;
    max-width: 100%;
  }

  .winner-text {
    color: #f4d03f;
    font-weight: 700;
  }

  .team-list-votes {
    background: rgba(26, 26, 78, 0.08);
    padding: 0.375rem 0.875rem;
    border-radius: 8px;
    font-weight: 700;
    color: #1a1a4e;
    font-size: 0.875rem;
    min-width: 40px;
    text-align: center;
    white-space: nowrap; /* Prevent line breaks */
    flex-shrink: 0; /* Prevent score from shrinking */
  }


  .status-icon {
    width: 12px;
    height: 12px;
    display: block;
  }

  .status-icon.completed {
    color: #4ecdc4;
  }

  .status-icon.pending {
    color: #f4d03f;
  }

  .status-icon.waiting {
    color: rgba(26, 26, 78, 0.4);
  }

  /* Accordion */
  .match-detail-expanded {
    animation: slideDown 0.3s ease-out;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      max-height: 0;
      overflow: hidden;
    }
    to {
      opacity: 1;
      max-height: 3000px;
    }
  }

  /* Collapse Button */
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
</style>
