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
    transactions,
    session,
    getRoundLabel,
    onToggleExpand,
    toggleVideo,
    voteOnMatch,
  } = $props();
</script>

<!-- Compact Match List Item -->
<button onclick={onToggleExpand} class="match-list-item">
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
      {transactions}
      {session}
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
    gap: 1.5rem;
    padding: 1rem 1.5rem;
    background: white;
    border: 2px solid rgba(26, 26, 78, 0.08);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
    width: 100%;
  }

  .match-list-item:hover {
    border-color: rgba(78, 205, 196, 0.3);
    box-shadow: 0 4px 16px rgba(78, 205, 196, 0.15);
    transform: translateY(-2px);
  }

  /* Left: Project 1 */
  .match-list-project-left {
    text-align: left;
    justify-self: start;
  }

  /* Center: Scores and VS */
  .match-list-center {
    display: flex;
    align-items: center;
    gap: 1rem;
    justify-self: center;
  }

  /* Right: Project 2 */
  .match-list-project-right {
    text-align: right;
    justify-self: end;
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
  }

  .match-list-vs {
    color: rgba(26, 26, 78, 0.4);
    font-weight: 600;
    font-size: 0.875rem;
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

