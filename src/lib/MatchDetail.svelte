<script>
  import MatchVoters from "$lib/MatchVoters.svelte";
  import { getUserProfile, prefetchUserProfiles } from "$lib/userProfileCache";

  // Props
  let {
    match,
    project1,
    project2,
    votes1,
    votes2,
    percent1,
    percent2,
    isActive,
    expandedVideo,
    votingAnimation,
    transactions,
    session,
    toggleVideo,
    voteOnMatch,
  } = $props();

  // User profiles fetched from API
  let user1 = $state(null);
  let user2 = $state(null);

  // Fetch user profiles when component mounts or projects change
  $effect(() => {
    const userIds = [];
    if (project1?.userId) userIds.push(project1.userId);
    if (project2?.userId) userIds.push(project2.userId);

    if (userIds.length > 0) {
      prefetchUserProfiles(userIds).then(() => {
        if (project1?.userId) {
          getUserProfile(project1.userId).then((profile) => {
            user1 = { name: profile.name, image: profile.image };
          });
        }
        if (project2?.userId) {
          getUserProfile(project2.userId).then((profile) => {
            user2 = { name: profile.name, image: profile.image };
          });
        }
      });
    }
  });
</script>

<div class="match-card">
  {#if expandedVideo === `${match.id}-p1` || expandedVideo === `${match.id}-p2`}
    <!-- Video Playing (Full Width, Hides Both Projects) -->
    <div class="video-playing-full">
      <iframe
        src="https://www.youtube.com/embed/vHfVI_4unYY?rel=0&modestbranding=1&autoplay=1"
        title="Project Pitch Video"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowfullscreen
        class="video-iframe-full-width"
      ></iframe>
      <!-- Close Button Below Video -->
      <div class="video-close-container">
        <button
          class="close-video-btn-bottom"
          onclick={() => toggleVideo("")}
          aria-label="Close video"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            class="close-icon"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
          Close Video
        </button>
      </div>
    </div>
  {:else}
    <!-- Projects Grid (2 columns) -->
    <div class="projects-grid">
      <!-- Project 1 Card (Yellow Theme) -->
      <div
        class="project-card project-card-yellow"
        class:loser={match.winnerId && match.winnerId !== match.project1Id}
      >
        <!-- Project Info Section -->
        <div class="project-info-section">
          <!-- Founder Profile & Project Info -->
          <div class="project-header">
            <div class="founder-avatar-container">
              {#if user1 && user1.image}
                <img
                  src={user1.image}
                  alt={user1.name || "User"}
                  class="founder-avatar"
                />
              {:else}
                <div class="founder-avatar-placeholder">
                  {user1?.name?.[0] || project1?.userId?.[0] || "?"}
                </div>
              {/if}
            </div>
            <div class="project-info-header">
              <h3 class="project-title">
                {project1?.title || "TBD"}
              </h3>
              <span class="founder-name">{user1?.name || "Anonymous"}</span>
            </div>
          </div>

          {#if project1?.description}
            <p class="project-description">
              {project1.description}
            </p>
          {/if}
        </div>

        <!-- Video Preview Card (16:9) -->
        <div class="video-card">
          <div
            class="video-thumbnail"
            style="background-image: url('https://picsum.photos/seed/{project1?.id ||
              'project1'}/1280/720')"
          >
            <button
              class="play-btn-center"
              onclick={() => toggleVideo(`${match.id}-p1`)}
              aria-label="Watch {project1?.title || 'project'} pitch"
            >
              <svg class="play-icon" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Voters for Project 1 -->
        <MatchVoters projectWalletId={match.project1WalletId} {transactions} />

        {#if match.winnerId === match.project1Id}
          <div class="winner-badge winner-yellow">
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path
                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
              />
            </svg>
            Winner
          </div>
        {/if}
      </div>

      <!-- Project 2 Card (Teal Theme) -->
      <div
        class="project-card project-card-teal"
        class:loser={match.winnerId && match.winnerId !== match.project2Id}
      >
        <!-- Project Info Section -->
        <div class="project-info-section">
          <!-- Founder Profile & Project Info -->
          <div class="project-header">
            <div class="founder-avatar-container">
              {#if user2 && user2.image}
                <img
                  src={user2.image}
                  alt={user2.name || "User"}
                  class="founder-avatar"
                />
              {:else}
                <div class="founder-avatar-placeholder">
                  {user2?.name?.[0] || project2?.userId?.[0] || "?"}
                </div>
              {/if}
            </div>
            <div class="project-info-header">
              <h3 class="project-title">
                {project2?.title || "TBD"}
              </h3>
              <span class="founder-name">{user2?.name || "Anonymous"}</span>
            </div>
          </div>

          {#if project2?.description}
            <p class="project-description">
              {project2.description}
            </p>
          {/if}
        </div>

        <!-- Video Preview Card (16:9) -->
        <div class="video-card">
          <div
            class="video-thumbnail"
            style="background-image: url('https://picsum.photos/seed/{project2?.id ||
              'project2'}/1280/720')"
          >
            <button
              class="play-btn-center"
              onclick={() => toggleVideo(`${match.id}-p2`)}
              aria-label="Watch {project2?.title || 'project'} pitch"
            >
              <svg class="play-icon" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Voters for Project 2 -->
        <MatchVoters projectWalletId={match.project2WalletId} {transactions} />

        {#if match.winnerId === match.project2Id}
          <div class="winner-badge winner-teal">
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path
                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
              />
            </svg>
            Winner
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Progress Bar with Vote Buttons and Percentages -->
  <div class="progress-bar-wrapper">
    {#if session.data && isActive}
      <button
        onclick={() => voteOnMatch(match.id, "project1")}
        class="vote-button-bar vote-button-bar-left"
        class:vote-pulse={votingAnimation === `${match.id}-project1`}
        aria-label="Vote for {project1?.title || 'Project 1'}"
        title="Vote for {project1?.title || 'Project 1'}"
      >
        <div class="vote-button-content">
          <svg
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            class="heart-icon-vote"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
          <span class="vote-label">Vote</span>
        </div>
      </button>
    {/if}

    <!-- Vote count for project 1 -->
    <div
      class="vote-count-inline vote-count-left"
      class:loser-count={match.winnerId && match.winnerId !== match.project1Id}
    >
      <span class="count-number">{votes1}</span>
    </div>

    <div class="progress-bar-container">
      <div
        class="progress-bar-yellow"
        style="width: {percent1}%"
        class:vote-pulse={votingAnimation === `${match.id}-project1`}
        class:loser-bar={match.winnerId && match.winnerId !== match.project1Id}
      >
        <span class="progress-percent">{percent1.toFixed(1)}%</span>
      </div>
      <div
        class="progress-bar-teal"
        style="width: {percent2}%"
        class:vote-pulse={votingAnimation === `${match.id}-project2`}
        class:loser-bar={match.winnerId && match.winnerId !== match.project2Id}
      >
        <span class="progress-percent">{percent2.toFixed(1)}%</span>
      </div>
    </div>

    <!-- Vote count for project 2 -->
    <div
      class="vote-count-inline vote-count-right"
      class:loser-count={match.winnerId && match.winnerId !== match.project2Id}
    >
      <span class="count-number">{votes2}</span>
    </div>

    {#if session.data && isActive}
      <button
        onclick={() => voteOnMatch(match.id, "project2")}
        class="vote-button-bar vote-button-bar-right"
        class:vote-pulse={votingAnimation === `${match.id}-project2`}
        aria-label="Vote for {project2?.title || 'Project 2'}"
        title="Vote for {project2?.title || 'Project 2'}"
      >
        <div class="vote-button-content">
          <svg
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            class="heart-icon-vote"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
          <span class="vote-label">Vote</span>
        </div>
      </button>
    {/if}
  </div>

  {#if !isActive && !match.winnerId}
    <div class="match-waiting">
      <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path
          d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"
        />
      </svg>
      Waiting for previous round...
    </div>
  {/if}
</div>

<style>
  .match-card {
    background: #f8f9fa;
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(26, 26, 78, 0.12);
    border: 2px solid rgba(26, 26, 78, 0.08);
    position: relative;
  }

  /* Projects Grid (2 columns) */
  .projects-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    padding: 1rem;
  }

  /* Individual Project Card */
  .project-card {
    display: flex;
    flex-direction: column;
    background: white;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
    position: relative; /* For winner badge positioning */
  }

  .project-card-yellow {
    border-top: 4px solid #f4d03f;
  }

  .project-card-teal {
    border-top: 4px solid #4ecdc4;
  }

  /* Loser styling - black and white/grey */
  .project-card.loser {
    filter: grayscale(100%);
    opacity: 0.6;
    position: relative;
  }

  .project-card.loser::after {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.15);
    pointer-events: none;
  }

  /* Project Info Section */
  .project-info-section {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    flex: 1; /* For video bottom alignment */
  }

  /* Project Header (Avatar + Title + Founder) */
  .project-header {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
  }

  .founder-avatar-container {
    flex-shrink: 0;
  }

  .founder-avatar {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    object-fit: cover;
    border: 3px solid #f4d03f;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .founder-avatar-placeholder {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: linear-gradient(135deg, #1a1a4e 0%, #2a2a6e 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 700;
    font-size: 1.5rem;
    border: 3px solid #f4d03f;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .project-card-teal .founder-avatar,
  .project-card-teal .founder-avatar-placeholder {
    border-color: #4ecdc4;
  }

  .project-info-header {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex: 1;
    min-width: 0;
  }

  .project-title {
    color: #1a1a4e;
    font-size: 1.5rem;
    font-weight: 800;
    line-height: 1.2;
    margin: 0;
  }

  .founder-name {
    color: rgba(26, 26, 78, 0.6);
    font-weight: 500;
    font-size: 0.875rem;
  }

  .project-description {
    color: rgba(26, 26, 78, 0.7);
    font-size: 0.9rem;
    line-height: 1.6;
    margin: 0;
  }

  /* Video Card (16:9) */
  .video-card {
    width: 100%;
    margin-top: auto; /* Push to bottom */
  }

  .video-thumbnail {
    width: 100%;
    aspect-ratio: 16 / 9;
    background-size: cover;
    background-position: center;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Play Button (Centered) */
  .play-btn-center {
    width: 80px;
    height: 80px;
    border: none;
    border-radius: 50%;
    background: rgba(244, 208, 63, 0.95);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  .play-btn-center:hover {
    transform: scale(1.1);
    background: rgba(244, 208, 63, 1);
    box-shadow: 0 12px 40px rgba(244, 208, 63, 0.5);
  }

  .play-icon {
    width: 36px;
    height: 36px;
    color: #1a1a4e;
    margin-left: 4px; /* Optical centering */
  }

  /* Video Playing State (Full Width, Replaces Both Projects) */
  .video-playing-full {
    position: relative;
    width: 100%;
    background: #000;
    overflow: hidden;
  }

  .video-iframe-full-width {
    width: 100%;
    height: 600px;
    border: none;
    display: block;
  }

  /* Close Button Container (Below Video, Above Progress Bar) */
  .video-close-container {
    display: flex;
    justify-content: center;
    padding: 1rem 1.5rem;
    background: #000;
  }

  .close-video-btn-bottom {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.15);
    backdrop-filter: blur(10px);
    color: white;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    border: 2px solid rgba(255, 255, 255, 0.2);
  }

  .close-video-btn-bottom:hover {
    background: rgba(255, 255, 255, 0.25);
    border-color: rgba(255, 255, 255, 0.4);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .close-icon {
    width: 20px;
    height: 20px;
    stroke-width: 2.5;
  }

  /* Winner Badge */
  .winner-badge {
    position: absolute;
    top: 10px;
    right: 10px;
    padding: 0.5rem 1rem;
    border-radius: 20px;
    font-weight: 700;
    font-size: 0.875rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    box-shadow: 0 4px 12px rgba(244, 208, 63, 0.4);
    animation: bounce 0.6s;
    z-index: 10;
  }

  .winner-yellow {
    background: linear-gradient(135deg, #f4d03f 0%, #e6c43a 100%);
    color: #1a1a4e;
  }

  .winner-teal {
    background: linear-gradient(135deg, #4ecdc4 0%, #45b8b0 100%);
    color: white;
  }

  @keyframes bounce {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-10px);
    }
  }

  .progress-bar-wrapper {
    display: flex;
    align-items: center;
    gap: 0;
    position: relative;
  }

  .progress-bar-container {
    height: 60px;
    display: flex;
    flex: 1;
    position: relative;
  }

  .progress-bar-yellow {
    height: 100%;
    background: linear-gradient(90deg, #f4d03f 0%, #e6c43a 100%);
    transition: width 0.6s ease-in-out;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }

  .progress-bar-teal {
    height: 100%;
    background: linear-gradient(90deg, #4ecdc4 0%, #45b8b0 100%);
    transition: width 0.6s ease-in-out;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }

  .progress-percent {
    font-size: 1.5rem;
    font-weight: 800;
    color: #1a1a4e;
    text-shadow: 0 2px 4px rgba(255, 255, 255, 0.3);
    white-space: nowrap;
  }

  .vote-button-bar {
    height: 60px;
    width: 100px; /* Wider to accommodate text */
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    position: relative;
    z-index: 10;
  }

  .vote-button-bar-left {
    background: linear-gradient(
      90deg,
      rgba(244, 208, 63, 0.25) 0%,
      rgba(244, 208, 63, 0.15) 100%
    );
    border-radius: 0 0 0 12px;
    color: #d4a915;
    border-bottom: 2px solid rgba(244, 208, 63, 0.3);
    border-left: 2px solid rgba(244, 208, 63, 0.3);
  }

  .vote-button-bar-right {
    background: linear-gradient(
      90deg,
      rgba(78, 205, 196, 0.15) 0%,
      rgba(78, 205, 196, 0.25) 100%
    );
    border-radius: 0 0 12px 0;
    color: #2d9d93;
    border-bottom: 2px solid rgba(78, 205, 196, 0.3);
    border-right: 2px solid rgba(78, 205, 196, 0.3);
  }

  .vote-button-bar:hover {
    transform: scale(1.05);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  }

  .vote-button-bar:active {
    transform: scale(0.95);
  }

  .vote-button-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    width: 100%;
    height: 100%;
  }

  .heart-icon-vote {
    width: 1.75rem;
    height: 1.75rem;
    stroke-width: 2.5;
  }

  .vote-label {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    line-height: 1;
  }

  .vote-count-inline {
    height: 60px;
    padding: 0 1.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 900;
    font-size: 1.75rem;
    min-width: 70px;
  }

  .vote-count-left {
    background: linear-gradient(135deg, #f4d03f 0%, #e6c43a 100%);
    color: #1a1a4e;
    text-shadow: 0 2px 4px rgba(255, 255, 255, 0.3);
  }

  .vote-count-right {
    background: linear-gradient(135deg, #4ecdc4 0%, #45b8b0 100%);
    color: white;
    text-shadow: 0 2px 4px rgba(26, 26, 78, 0.2);
  }

  .count-number {
    font-weight: 900;
    letter-spacing: -0.02em;
  }

  /* Loser styling for progress bar and vote counts */
  .loser-bar {
    background: linear-gradient(90deg, #9e9e9e 0%, #757575 100%) !important;
    filter: grayscale(100%);
  }

  .loser-count {
    background: linear-gradient(135deg, #e0e0e0 0%, #bdbdbd 100%) !important;
    color: #757575 !important;
    text-shadow: none !important;
  }

  /* Dopamine-hit animation */
  @keyframes votePulse {
    0% {
      transform: scale(1);
      filter: brightness(1);
    }
    25% {
      transform: scale(1.15);
      filter: brightness(1.3);
    }
    50% {
      transform: scale(1.05);
      filter: brightness(1.1);
    }
    75% {
      transform: scale(1.1);
      filter: brightness(1.2);
    }
    100% {
      transform: scale(1);
      filter: brightness(1);
    }
  }

  .vote-pulse {
    animation: votePulse 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .match-waiting {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 1rem;
    background: rgba(26, 26, 78, 0.05);
    color: rgba(26, 26, 78, 0.5);
    font-weight: 600;
    font-size: 0.875rem;
  }

  .w-5 {
    width: 1.25rem;
    height: 1.25rem;
  }

  @media (max-width: 768px) {
    .projects-grid {
      grid-template-columns: 1fr;
      gap: 0.75rem;
      padding: 0.75rem;
    }

    .project-info-section {
      padding: 1rem;
      gap: 0.75rem;
    }

    .project-header {
      gap: 0.75rem;
    }

    .founder-avatar,
    .founder-avatar-placeholder {
      width: 50px;
      height: 50px;
      font-size: 1.25rem;
    }

    .project-title {
      font-size: 1.25rem;
    }

    .founder-name {
      font-size: 0.8125rem;
    }

    .project-description {
      font-size: 0.875rem;
    }

    .play-btn-center {
      width: 60px;
      height: 60px;
    }

    .play-icon {
      width: 28px;
      height: 28px;
    }

    .video-iframe-full-width {
      height: 400px;
    }

    .progress-bar-container {
      height: 50px;
    }

    .vote-button-bar {
      height: 50px;
      width: 80px;
    }

    .heart-icon-vote {
      width: 1.5rem;
      height: 1.5rem;
    }

    .vote-label {
      font-size: 0.65rem;
    }

    .vote-count-inline {
      height: 50px;
      padding: 0 1rem;
      font-size: 1.5rem;
      min-width: 60px;
    }

    .progress-percent {
      font-size: 1.25rem;
    }
  }
</style>
