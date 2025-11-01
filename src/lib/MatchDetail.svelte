<script>
  import MatchVoters from "$lib/MatchVoters.svelte";
  import { getUserProfile, prefetchUserProfiles } from "$lib/userProfileCache";
  import { getYouTubeEmbedUrl } from "$lib/youtubeUtils";

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
    votes = [], // Array of vote records
    session,
    hasVoted = false,
    userVotingWeight = 0,
    toggleVideo,
    voteOnMatch,
  } = $props();

  // User profiles fetched from API
  let user1 = $state(null);
  let user2 = $state(null);
  // Track which user images have failed to load
  let failedImages = $state(new Set());
  // Track which thumbnails have failed to load
  let failedThumbnails = $state(new Set());

  // Get video URLs for each project (fallback to default if not provided)
  const video1Url = $derived(getYouTubeEmbedUrl(project1?.videoUrl));
  const video2Url = $derived(getYouTubeEmbedUrl(project2?.videoUrl));

  // Get thumbnail URLs - use database image if available and valid, otherwise fallback to Unsplash
  const thumbnail1Url = $derived(() => {
    const projectId = project1?.id || 'project1';
    // If thumbnail failed to load, use fallback
    if (failedThumbnails.has(`${projectId}-1`)) {
      return `https://picsum.photos/seed/${projectId}/1280/720`;
    }
    const customThumbnail = project1?.videoThumbnail;
    if (customThumbnail && typeof customThumbnail === 'string' && customThumbnail.trim().length > 0) {
      return customThumbnail.trim();
    }
    return `https://picsum.photos/seed/${projectId}/1280/720`;
  });
  const thumbnail2Url = $derived(() => {
    const projectId = project2?.id || 'project2';
    // If thumbnail failed to load, use fallback
    if (failedThumbnails.has(`${projectId}-2`)) {
      return `https://picsum.photos/seed/${projectId}/1280/720`;
    }
    const customThumbnail = project2?.videoThumbnail;
    if (customThumbnail && typeof customThumbnail === 'string' && customThumbnail.trim().length > 0) {
      return customThumbnail.trim();
    }
    return `https://picsum.photos/seed/${projectId}/1280/720`;
  });

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
        src={expandedVideo === `${match.id}-p1` ? video1Url : video2Url}
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
              {#if user1 && user1.image && !failedImages.has(project1?.userId || "")}
                <img
                  src={user1.image}
                  alt={user1.name || "User"}
                  class="founder-avatar"
                  onerror={() => {
                    if (project1?.userId) {
                      failedImages = new Set(failedImages).add(project1.userId);
                    }
                  }}
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
          <div class="video-thumbnail">
            <!-- Hidden img to detect load errors -->
            <img
              src={thumbnail1Url()}
              alt=""
              style="display: none;"
              onerror={() => {
                const projectId = project1?.id || 'project1';
                failedThumbnails = new Set(failedThumbnails).add(`${projectId}-1`);
              }}
            />
            <div
              class="video-thumbnail-bg"
              style="background-image: url('{thumbnail1Url()}')"
            ></div>
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
              {#if user2 && user2.image && !failedImages.has(project2?.userId || "")}
                <img
                  src={user2.image}
                  alt={user2.name || "User"}
                  class="founder-avatar"
                  onerror={() => {
                    if (project2?.userId) {
                      failedImages = new Set(failedImages).add(project2.userId);
                    }
                  }}
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
          <div class="video-thumbnail">
            <!-- Hidden img to detect load errors -->
            <img
              src={thumbnail2Url()}
              alt=""
              style="display: none;"
              onerror={() => {
                const projectId = project2?.id || 'project2';
                failedThumbnails = new Set(failedThumbnails).add(`${projectId}-2`);
              }}
            />
            <div
              class="video-thumbnail-bg"
              style="background-image: url('{thumbnail2Url()}')"
            ></div>
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
    {#if session.data && isActive && !hasVoted}
      <button
        onclick={() => voteOnMatch(match.id, "project1")}
        class="vote-button-bar vote-button-bar-left"
        class:vote-pulse={votingAnimation === `${match.id}-project1`}
        aria-label="Vote for {project1?.title || 'Project 1'}"
        title={`Vote for ${project1?.title || 'Project 1'}`}
      >
        <div class="vote-button-content">
          <svg
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            class="plus-icon-vote"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 4v16m8-8H4"
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
        {#if percent1 >= 5}
          <span class="progress-percent">{percent1.toFixed(1)}%</span>
        {/if}
      </div>
      <div
        class="progress-bar-teal"
        style="width: {percent2}%"
        class:vote-pulse={votingAnimation === `${match.id}-project2`}
        class:loser-bar={match.winnerId && match.winnerId !== match.project2Id}
      >
        {#if percent2 >= 5}
          <span class="progress-percent">{percent2.toFixed(1)}%</span>
        {/if}
      </div>
    </div>

    <!-- Vote count for project 2 -->
    <div
      class="vote-count-inline vote-count-right"
      class:loser-count={match.winnerId && match.winnerId !== match.project2Id}
    >
      <span class="count-number">{votes2}</span>
    </div>

    {#if session.data && isActive && !hasVoted}
      <button
        onclick={() => voteOnMatch(match.id, "project2")}
        class="vote-button-bar vote-button-bar-right"
        class:vote-pulse={votingAnimation === `${match.id}-project2`}
        aria-label="Vote for {project2?.title || 'Project 2'}"
        title={`Vote for ${project2?.title || 'Project 2'}`}
      >
        <div class="vote-button-content">
          <svg
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            class="plus-icon-vote"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 4v16m8-8H4"
            />
          </svg>
          <span class="vote-label">Vote</span>
        </div>
      </button>
    {/if}
  </div>

  <!-- Voters below progress bar -->
  <!-- Temporarily hidden - will be shown later -->
  <!-- <div class="voters-below-progress">
    <MatchVoters matchId={match.id} projectSide="project1" {votes} />
    <MatchVoters matchId={match.id} projectSide="project2" {votes} />
  </div> -->

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
    align-items: stretch; /* Stretch cards to same height */
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
    min-height: 0; /* Allow shrinking */
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
    flex: 0 0 auto; /* Don't grow/shrink - fixed size */
    min-height: 0; /* Allow content to determine height */
  }

  /* Ensure consistent spacing between info section and video */
  .project-card > .project-info-section + .video-card {
    margin-top: 0; /* Remove any default margin */
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
    flex: 0 0 auto; /* Fixed size, don't grow/shrink */
    margin-top: 0; /* No margin - sits directly after info section */
    min-height: 0; /* Allow flex shrinking */
    order: 2; /* Ensure video comes after info section */
  }

  /* Voters below progress bar */
  .voters-below-progress {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-top: 0; /* No padding between progress bar and voters */
  }

  .voters-below-progress :global(.voters-container) {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    background: rgba(255, 255, 255, 0.5);
    border-radius: 8px;
  }

  .video-thumbnail {
    width: 100%;
    aspect-ratio: 16 / 9;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border-radius: 12px;
    min-height: 120px; /* Ensure minimum height on mobile */
  }

  .video-thumbnail-bg {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
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

  @media (max-width: 768px) {
    .video-close-container {
      padding: 0.5rem 1rem; /* Reduced padding on mobile */
    }

    .close-video-btn-bottom {
      padding: 0.5rem 1rem; /* Smaller button on mobile */
      font-size: 0.875rem;
      gap: 0.375rem;
      border-radius: 8px;
      border-width: 1.5px;
    }

    .close-icon {
      width: 16px;
      height: 16px;
      stroke-width: 2;
    }
  }

  @media (max-width: 640px) {
    .video-close-container {
      padding: 0.375rem 0.75rem; /* Even smaller padding on very small screens */
    }

    .close-video-btn-bottom {
      padding: 0.375rem 0.75rem; /* Even smaller button */
      font-size: 0.75rem;
      gap: 0.25rem;
      border-radius: 6px;
    }

    .close-icon {
      width: 14px;
      height: 14px;
      stroke-width: 2;
    }
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
    transition: width 0.6s ease-in-out;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }

  .progress-bar-teal {
    height: 100%;
    background: linear-gradient(
      90deg,
      rgba(78, 205, 196, 0.15) 0%,
      rgba(78, 205, 196, 0.25) 100%
    );
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
    white-space: nowrap;
  }

  .progress-bar-yellow .progress-percent {
    color: #b8860b; /* Darker yellow */
  }

  .progress-bar-teal .progress-percent {
    color: #1e8b85; /* Darker teal */
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
    background: linear-gradient(135deg, #f4d03f 0%, #e6c43a 100%);
    border-radius: 0 0 0 12px;
    color: #1a1a4e;
    border: none;
    text-shadow: 0 2px 4px rgba(255, 255, 255, 0.3);
  }

  .vote-button-bar-right {
    background: linear-gradient(135deg, #4ecdc4 0%, #45b8b0 100%);
    border-radius: 0 0 12px 0;
    color: white;
    border: none;
    text-shadow: 0 2px 4px rgba(26, 26, 78, 0.2);
  }

  .vote-button-bar:hover:not(:disabled) {
    transform: scale(1.05);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  }

  .vote-button-bar:active:not(:disabled) {
    transform: scale(0.95);
  }

  .vote-button-bar:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .vote-button-bar.voted-button {
    background: linear-gradient(
      90deg,
      rgba(78, 205, 196, 0.4) 0%,
      rgba(78, 205, 196, 0.3) 100%
    ) !important;
    border-color: rgba(78, 205, 196, 0.5) !important;
    color: rgba(78, 205, 196, 0.8) !important;
  }

  .vote-button-bar-left.voted-button {
    background: linear-gradient(
      90deg,
      rgba(244, 208, 63, 0.4) 0%,
      rgba(244, 208, 63, 0.3) 100%
    ) !important;
    border-color: rgba(244, 208, 63, 0.5) !important;
    color: rgba(244, 208, 63, 0.8) !important;
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

  .plus-icon-vote {
    width: 1.25rem;
    height: 1.25rem;
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
    width: 60px; /* Make it square */
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 900;
    font-size: 1.75rem;
    flex-shrink: 0;
  }

  .vote-count-left {
    background: linear-gradient(
      90deg,
      rgba(244, 208, 63, 0.55) 0%,
      rgba(244, 208, 63, 0.45) 100%
    );
    color: #b8860b; /* Darker yellow */
  }

  .vote-count-right {
    background: linear-gradient(
      90deg,
      rgba(78, 205, 196, 0.45) 0%,
      rgba(78, 205, 196, 0.55) 100%
    );
    color: #1e8b85; /* Darker teal */
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
      grid-template-columns: 1fr 1fr; /* Keep side-by-side on mobile */
      gap: 0.5rem;
      padding: 0.5rem;
      align-items: stretch; /* Stretch cards to same height for video alignment */
    }

    .project-info-section {
      padding: 0.75rem;
      gap: 0.5rem;
    }

    .project-header {
      gap: 0.5rem;
      flex-wrap: wrap; /* Allow wrapping if needed */
    }

    .founder-avatar,
    .founder-avatar-placeholder {
      width: 40px;
      height: 40px;
      font-size: 1rem;
      flex-shrink: 0;
    }

    .project-title {
      font-size: 0.875rem;
      line-height: 1.2;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    .founder-name {
      font-size: 0.7rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .project-description {
      font-size: 0.7rem;
      line-height: 1.4;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 3; /* Limit to 3 lines */
      -webkit-box-orient: vertical;
    }

    .video-thumbnail {
      min-height: 100px; /* Ensure thumbnail is visible on mobile */
      border-radius: 8px;
    }

    .play-btn-center {
      width: 50px;
      height: 50px;
      z-index: 10; /* Ensure play button is clickable */
    }

    .play-icon {
      width: 24px;
      height: 24px;
      margin-left: 2px; /* Optical centering */
    }

    .video-iframe-full-width {
      height: 300px;
    }

    .video-card {
      margin-top: 0.5rem; /* Add spacing on mobile */
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

    .vote-button-bar {
      height: 50px;
      width: 70px; /* Smaller on mobile */
      flex-shrink: 0; /* Don't shrink */
    }

    .vote-button-bar-left {
      order: -2; /* First - left button */
    }

    .vote-button-bar-right {
      order: 2; /* Last - right button */
    }

    .vote-count-inline {
      height: 50px;
      width: 50px; /* Make it square */
      padding: 0;
      font-size: 1rem; /* Smaller font */
      flex-shrink: 0; /* Don't shrink */
    }

    .vote-count-left {
      order: -1; /* After left button, before progress bar */
    }

    .vote-count-right {
      order: 1; /* After progress bar, before right button */
    }

    .plus-icon-vote {
      width: 1rem;
      height: 1rem;
    }

    .vote-label {
      font-size: 0.6rem;
      line-height: 1;
    }

    .progress-percent {
      font-size: 1rem;
    }

    .winner-badge {
      top: 8px;
      right: 8px;
      padding: 0.375rem 0.75rem;
      font-size: 0.75rem;
    }

    .match-waiting {
      padding: 0.75rem;
      font-size: 0.8125rem;
    }
  }

  @media (max-width: 640px) {
    .projects-grid {
      padding: 0.375rem;
      gap: 0.375rem;
      grid-template-columns: 1fr 1fr; /* Still side-by-side */
    }

    .project-info-section {
      padding: 0.625rem;
      gap: 0.375rem;
    }

    .project-header {
      gap: 0.375rem;
    }

    .founder-avatar,
    .founder-avatar-placeholder {
      width: 36px;
      height: 36px;
      font-size: 0.875rem;
    }

    .project-title {
      font-size: 0.8125rem;
      -webkit-line-clamp: 2; /* Max 2 lines on very small screens */
    }

    .founder-name {
      font-size: 0.65rem;
    }

    .project-description {
      font-size: 0.65rem;
      -webkit-line-clamp: 2; /* Max 2 lines on very small screens */
      line-height: 1.3;
    }

    .video-thumbnail {
      min-height: 90px; /* Ensure thumbnail is visible on very small screens */
      border-radius: 6px;
    }

    .play-btn-center {
      width: 44px;
      height: 44px;
      z-index: 10; /* Ensure play button is clickable */
    }

    .play-icon {
      width: 20px;
      height: 20px;
    }

    .video-card {
      margin-top: 0.375rem; /* Add spacing on very small screens */
    }

    .progress-bar-wrapper {
      gap: 0; /* No gap - elements flush together */
    }

    .progress-bar-container {
      height: 45px;
      flex: 1; /* Take remaining space */
    }

    .vote-button-bar {
      height: 45px;
      width: 60px;
      flex-shrink: 0;
    }

    .vote-count-inline {
      height: 45px;
      width: 45px; /* Make it square */
      padding: 0;
      font-size: 0.9rem; /* Smaller font */
      flex-shrink: 0;
    }

    .progress-percent {
      font-size: 0.875rem; /* Smaller percentage text */
    }

    .vote-label {
      font-size: 0.55rem;
    }

    .plus-icon-vote {
      width: 0.875rem;
      height: 0.875rem;
    }
  }
</style>
