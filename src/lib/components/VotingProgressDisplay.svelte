<script lang="ts">
  import { onMount } from "svelte";
  import { getUserProfile } from "$lib/userProfileCache";

  let { matchId, projectSide } = $props<{
    matchId: string;
    projectSide: "project1" | "project2";
  }>();

  let projectVotes = $state<number>(0);
  let opponentVotes = $state<number>(0);
  let voteDifference = $state<number>(0);
  let project = $state<any>(null);
  let opponentProject = $state<any>(null);
  let founderProfile = $state<{ name: string | null; image: string | null } | null>(null);
  let loading = $state(true);

  onMount(async () => {
    try {
      // Fetch match details and vote data in parallel
      const [matchResponse, voteResponse] = await Promise.all([
        fetch(`/alpha/api/match-details/${matchId}`),
        fetch(`/alpha/api/match-vote-data/${matchId}`)
      ]);

      if (matchResponse.ok) {
        const matchData = await matchResponse.json();
        project = projectSide === "project1" ? matchData.project1 : matchData.project2;
        opponentProject = projectSide === "project1" ? matchData.project2 : matchData.project1;
        
        // Fetch founder profile
        if (project?.userId) {
          const profile = await getUserProfile(project.userId);
          founderProfile = { name: profile.name, image: profile.image };
        }
      }

      if (voteResponse.ok) {
        const voteData = await voteResponse.json();
        projectVotes = voteData[projectSide] || 0;
        opponentVotes = voteData[projectSide === "project1" ? "project2" : "project1"] || 0;
        voteDifference = projectVotes - opponentVotes;
      }
    } catch (error) {
      console.error("Failed to fetch voting progress data:", error);
    } finally {
      loading = false;
    }
  });

  const totalVotes = projectVotes + opponentVotes;
  const projectPercentage = totalVotes > 0 ? (projectVotes / totalVotes) * 100 : 50;
  const opponentPercentage = totalVotes > 0 ? (opponentVotes / totalVotes) * 100 : 50;
  const isAhead = voteDifference > 0;
  const isBehind = voteDifference < 0;
  const isTied = voteDifference === 0;
  
  // Determine which color scheme based on project side
  const isProject1 = projectSide === "project1";
</script>

{#if !loading && project && totalVotes > 0}
  <div class="voting-progress-display">
    <!-- Compact project card -->
    <div class="project-card-compact" class:project-card-yellow={isProject1} class:project-card-teal={!isProject1}>
      <div class="project-header-compact">
        {#if founderProfile?.image}
          <img 
            src={founderProfile.image} 
            alt={founderProfile.name || "Founder"} 
            class="founder-avatar-compact"
            onerror={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        {/if}
        {#if (!founderProfile?.image || founderProfile.image === null)}
          <div class="founder-avatar-placeholder-compact" class:project-card-yellow={isProject1} class:project-card-teal={!isProject1}>
            {founderProfile?.name?.[0]?.toUpperCase() || "?"}
          </div>
        {/if}
        <div class="project-info-compact">
          <h3 class="project-title-compact">{project.title}</h3>
          <p class="founder-name-compact">{founderProfile?.name || "Unknown"}</p>
        </div>
      </div>
    </div>

    <!-- Progress bar similar to match cards -->
    <div class="progress-bar-wrapper-compact">
      <div class="progress-bar-container-compact">
        <div 
          class="progress-bar" 
          class:progress-bar-yellow={isProject1}
          class:progress-bar-teal={!isProject1}
          style="width: {projectPercentage}%"
        >
          {#if projectPercentage >= 5}
            <span class="progress-percent">{projectPercentage.toFixed(1)}%</span>
          {/if}
        </div>
        <div 
          class="progress-bar" 
          class:progress-bar-yellow={!isProject1}
          class:progress-bar-teal={isProject1}
          style="width: {opponentPercentage}%"
        >
          {#if opponentPercentage >= 5}
            <span class="progress-percent">{opponentPercentage.toFixed(1)}%</span>
          {/if}
        </div>
      </div>
      
      <!-- Vote counts -->
      <div class="vote-count-compact vote-count-left">
        <span class="count-number">{projectVotes || 0}</span>
      </div>
      <div class="vote-count-compact vote-count-right">
        <span class="count-number">{opponentVotes || 0}</span>
      </div>
    </div>

    <!-- Vote difference display -->
    <div class="vote-difference">
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

  .progress-bar-wrapper-compact {
    display: flex;
    align-items: stretch;
    gap: 0;
    position: relative;
    height: 50px;
  }

  .progress-bar-container-compact {
    height: 100%;
    display: flex;
    flex: 1;
    position: relative;
    overflow: hidden;
  }

  .progress-bar {
    height: 100%;
    transition: width 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    min-width: 0;
  }

  .progress-bar-yellow {
    background: linear-gradient(
      90deg,
      rgba(244, 208, 63, 0.25) 0%,
      rgba(244, 208, 63, 0.15) 100%
    );
    left: 0;
    transform-origin: left center;
  }

  .progress-bar-teal {
    background: linear-gradient(
      90deg,
      rgba(78, 205, 196, 0.15) 0%,
      rgba(78, 205, 196, 0.25) 100%
    );
    right: 0;
    margin-left: auto;
    transform-origin: right center;
  }

  .progress-percent {
    font-size: 1.125rem;
    font-weight: 800;
    color: #1a1a4e;
    white-space: nowrap;
  }

  .progress-bar-yellow .progress-percent {
    color: #b8860b;
  }

  .progress-bar-teal .progress-percent {
    color: #1e8b85;
  }

  .vote-count-compact {
    height: 50px;
    width: 50px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .vote-count-left {
    margin-right: 0.5rem;
  }

  .vote-count-right {
    margin-left: 0.5rem;
  }

  .count-number {
    font-size: 1.25rem;
    font-weight: 900;
    color: #1a1a4e;
  }

  .vote-difference {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 0.25rem;
    padding-top: 0.5rem;
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
    color: #dc267f;
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

    .progress-bar-wrapper-compact {
      height: 45px;
    }

    .vote-count-compact {
      height: 45px;
      width: 45px;
    }

    .count-number {
      font-size: 1.125rem;
    }

    .progress-percent {
      font-size: 1rem;
    }

    .vote-sign {
      font-size: 1.75rem;
    }

    .vote-number {
      font-size: 2rem;
    }
  }
</style>

