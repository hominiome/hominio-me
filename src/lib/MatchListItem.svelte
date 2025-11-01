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
    onToggleExpand,
    toggleVideo,
    voteOnMatch,
  } = $props();
</script>

<!-- Compact Match List Item -->
<button onclick={onToggleExpand} class="match-list-item" class:voted-match={hasVoted && isActive}>
  <!-- Far Left: Match State Indicator -->
  <div class="match-list-indicator">
    {#if match.winnerId}
      <svg class="status-icon completed" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    {:else if isActive}
      <svg class="status-icon pending" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="12" r="6" />
      </svg>
    {:else}
      <svg class="status-icon waiting" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M8 7h8M8 12h8M8 17h4" />
      </svg>
    {/if}
  </div>

  <!-- Left: Project 1 -->
  <div class="match-list-project-left">
    <span
      class="team-list-name"
      class:winner-text={match.winnerId === match.project1Id}
    >
      {project1?.title || "TBD"}
    </span>
  </div>

  <!-- Center: Scores and VS -->
  <div class="match-list-center">
    <span class="team-list-votes">{votes1}</span>
    <span class="match-list-vs">VS</span>
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

  <!-- Far Right: Open Button -->
  <div class="match-list-action">
    <span class="open-match-btn">
      {expandedMatch === match.id ? "Close" : "Open"}
    </span>
  </div>
</button>

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
      {toggleVideo}
      {voteOnMatch}
    />
  </div>
{/if}

<style>
  /* Compact Match List */
  .match-list-item {
    display: grid;
    grid-template-columns: auto 1fr auto 1fr auto;
    align-items: center;
    gap: 1rem 1.5rem;
    padding: 1rem 1.5rem;
    background: white;
    border: 2px solid rgba(26, 26, 78, 0.08);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
    width: 100%;
  }

  @media (max-width: 768px) {
    .match-list-item {
      grid-template-columns: auto 1fr auto 1fr auto;
      gap: 0.5rem 0.75rem;
      padding: 0.875rem 1rem;
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
      gap: 0.5rem; /* Reduce gap on mobile */
    }

    .match-list-action {
      /* Keep action button in place */
    }

    .team-list-name {
      font-size: 0.8125rem;
      max-width: 100%;
    }

    .team-list-votes {
      padding: 0.25rem 0.5rem;
      font-size: 0.75rem;
      min-width: 28px;
    }

    .match-list-vs {
      font-size: 0.7rem;
    }

    .open-match-btn {
      padding: 0.375rem 0.75rem;
      font-size: 0.75rem;
    }

    .match-list-indicator {
      width: 24px;
      height: 24px;
    }

    .status-icon {
      width: 16px;
      height: 16px;
    }
  }

  @media (max-width: 480px) {
    .match-list-item {
      gap: 0.375rem 0.5rem;
      padding: 0.75rem 0.875rem;
    }

    .match-list-project-left,
    .match-list-project-right {
      max-width: 90px; /* Even smaller on very small screens */
    }

    .team-list-name {
      font-size: 0.75rem;
    }

    .team-list-votes {
      padding: 0.25rem 0.375rem;
      font-size: 0.7rem;
      min-width: 24px;
    }

    .match-list-vs {
      font-size: 0.65rem;
    }

    .match-list-center {
      gap: 0.375rem;
    }

    .open-match-btn {
      padding: 0.3125rem 0.625rem;
      font-size: 0.6875rem;
    }
  }

  .match-list-item:hover {
    border-color: rgba(78, 205, 196, 0.3);
    box-shadow: 0 4px 16px rgba(78, 205, 196, 0.15);
    transform: translateY(-2px);
  }

  /* Styling for voted matches - make them less prominent */
  .match-list-item.voted-match {
    opacity: 0.6;
    background: rgba(255, 255, 255, 0.7);
    border-color: rgba(26, 26, 78, 0.05);
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

  .match-list-item.voted-match .match-list-vs {
    color: rgba(26, 26, 78, 0.25);
  }

  .match-list-item.voted-match .open-match-btn {
    background: linear-gradient(135deg, rgba(78, 205, 196, 0.6) 0%, rgba(26, 26, 78, 0.6) 100%);
    opacity: 0.8;
  }

  /* Left: Project 1 */
  .match-list-project-left {
    text-align: left;
    justify-self: start;
    min-width: 0; /* Allow flex shrinking */
    overflow: hidden;
  }

  /* Center: Scores and VS */
  .match-list-center {
    display: flex;
    align-items: center;
    gap: 1rem;
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

  /* Far Left: Match State Indicator */
  .match-list-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
  }

  /* Far Right: Action - Light Mode with Brand Colors */
  .match-list-action {
    display: flex;
    align-items: center;
    justify-self: end;
  }

  .team-list-name {
    font-weight: 600;
    color: #1a1a4e;
    font-size: 1rem;
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

  .match-list-vs {
    color: rgba(26, 26, 78, 0.4);
    font-weight: 600;
    font-size: 0.875rem;
    white-space: nowrap; /* Prevent line breaks */
    flex-shrink: 0; /* Prevent VS from shrinking */
  }

  .open-match-btn {
    padding: 0.5rem 1rem;
    background: linear-gradient(135deg, #4ecdc4 0%, #1a1a4e 100%);
    color: white;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.875rem;
    transition: all 0.2s;
  }

  .match-list-item:hover .open-match-btn {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(78, 205, 196, 0.3);
  }

  .status-icon {
    width: 20px;
    height: 20px;
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
</style>

