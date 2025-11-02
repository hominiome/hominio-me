<script lang="ts">
  import { onMount } from "svelte";

  let { matchId, projectSide } = $props<{
    matchId: string;
    projectSide: "project1" | "project2";
  }>();

  let projectVotes = $state<number>(0);
  let opponentVotes = $state<number>(0);
  let voteDifference = $state<number>(0);
  let loading = $state(true);

  onMount(async () => {
    try {
      // Fetch match vote data
      const response = await fetch(`/alpha/api/match-vote-data/${matchId}`);
      if (response.ok) {
        const data = await response.json();
        projectVotes = data[projectSide] || 0;
        opponentVotes = data[projectSide === "project1" ? "project2" : "project1"] || 0;
        voteDifference = projectVotes - opponentVotes;
      }
    } catch (error) {
      console.error("Failed to fetch match vote data:", error);
    } finally {
      loading = false;
    }
  });

  const totalVotes = projectVotes + opponentVotes;
  const projectPercentage = totalVotes > 0 ? (projectVotes / totalVotes) * 100 : 50;
  const isAhead = voteDifference > 0;
  const isBehind = voteDifference < 0;
  const isTied = voteDifference === 0;
</script>

{#if !loading && totalVotes > 0}
  <div class="voting-progress-display">
    <!-- Vote count display -->
    <div class="vote-count">
      {#if isAhead}
        <span class="vote-sign positive">+</span>
        <span class="vote-number positive">{Math.abs(voteDifference)}</span>
      {:else if isBehind}
        <span class="vote-sign negative">-</span>
        <span class="vote-number negative">{Math.abs(voteDifference)}</span>
      {:else}
        <span class="vote-sign neutral">=</span>
        <span class="vote-number neutral">0</span>
      {/if}
    </div>

    <!-- Progress bar -->
    <div class="progress-bar-container">
      <div 
        class="progress-bar" 
        style="width: {projectPercentage}%"
        class:ahead={isAhead}
        class:behind={isBehind}
        class:tied={isTied}
      ></div>
    </div>

    <!-- Vote totals -->
    <div class="vote-totals">
      <span class="total-label">Your votes:</span>
      <span class="total-value">{projectVotes}</span>
    </div>
  </div>
{/if}

<style>
  .voting-progress-display {
    width: 100%;
    padding: 1.5rem;
    background: linear-gradient(
      135deg,
      rgba(26, 26, 78, 0.05) 0%,
      rgba(78, 205, 196, 0.05) 100%
    );
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .vote-count {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 0.25rem;
  }

  .vote-sign {
    font-size: 3rem;
    font-weight: 900;
    line-height: 1;
  }

  .vote-number {
    font-size: 4rem;
    font-weight: 900;
    line-height: 1;
  }

  .vote-sign.positive,
  .vote-number.positive {
    color: #4ecdc4;
  }

  .vote-sign.negative,
  .vote-number.negative {
    color: #dc267f;
  }

  .vote-sign.neutral,
  .vote-number.neutral {
    color: #1a1a4e;
    opacity: 0.6;
  }

  .progress-bar-container {
    width: 100%;
    height: 12px;
    background: rgba(26, 26, 78, 0.1);
    border-radius: 6px;
    overflow: hidden;
    position: relative;
  }

  .progress-bar {
    height: 100%;
    border-radius: 6px;
    transition: width 0.3s ease, background 0.3s ease;
  }

  .progress-bar.ahead {
    background: linear-gradient(90deg, #4ecdc4 0%, #259fa6 100%);
  }

  .progress-bar.behind {
    background: linear-gradient(90deg, #dc267f 0%, #b91c73 100%);
  }

  .progress-bar.tied {
    background: linear-gradient(90deg, #1a1a4e 0%, #2d2d5e 100%);
  }

  .vote-totals {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: #1a1a4e;
    opacity: 0.7;
  }

  .total-label {
    font-weight: 600;
  }

  .total-value {
    font-weight: 900;
    font-size: 1rem;
  }

  @media (max-width: 768px) {
    .voting-progress-display {
      padding: 1.25rem;
      gap: 0.875rem;
    }

    .vote-sign {
      font-size: 2.5rem;
    }

    .vote-number {
      font-size: 3rem;
    }

    .vote-totals {
      font-size: 0.75rem;
    }

    .total-value {
      font-size: 0.875rem;
    }
  }
</style>

