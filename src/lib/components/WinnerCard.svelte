<script>
  import { getUserProfile, prefetchUserProfiles } from "$lib/userProfileCache";
  import { getYouTubeEmbedUrl } from "$lib/youtubeUtils";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import Icon from "@iconify/svelte";

  let { cup, winnerProject } = $props();

  // User profile for winner
  let winnerProfile = $state({
    name: null,
    image: null,
  });
  let failedImage = $state(false);
  let failedThumbnail = $state(false);
  let isVideoPlaying = $state(false);

  // Get video URL with autoplay for inline playback
  const videoUrl = $derived(getYouTubeEmbedUrl(winnerProject?.videoUrl, true));

  // Get thumbnail URL
  const thumbnailUrl = $derived(() => {
    const projectId = winnerProject?.id || "project";
    if (failedThumbnail) {
      return `https://picsum.photos/seed/${projectId}/1280/720`;
    }
    const customThumbnail = winnerProject?.bannerImage;
    if (
      customThumbnail &&
      typeof customThumbnail === "string" &&
      customThumbnail.trim().length > 0
    ) {
      return customThumbnail.trim();
    }
    return `https://picsum.photos/seed/${projectId}/1280/720`;
  });

  // Fetch user profile
  $effect(() => {
    if (winnerProject?.userId) {
      prefetchUserProfiles([winnerProject.userId]).then(() => {
        getUserProfile(winnerProject.userId).then((profile) => {
          winnerProfile = { name: profile.name, image: profile.image };
        });
      });
    }
  });
</script>

<div class="winner-card">
  <!-- Cup Header -->
  <div class="cup-header-section">
    <div class="cup-header-content">
      {#if cup.logoImageUrl}
        <img src={cup.logoImageUrl} alt="{cup.name} logo" class="cup-logo" />
      {/if}
      <div class="cup-header-text">
        <h3 class="cup-name">{cup.name}</h3>
        <span class="cup-status">Champion</span>
      </div>
    </div>
    <div class="trophy-icon-large">
      <Icon icon="mdi:trophy" />
    </div>
  </div>

  <!-- Winner Project Card -->
  <div class="project-card project-card-winner">
    <!-- Project Info Section -->
    <div class="project-info-section">
      <!-- Founder Profile & Project Info -->
      <div class="project-header">
        <div class="founder-avatar-container">
          {#if ((winnerProject?.profileImageUrl && winnerProject.profileImageUrl.trim()) || winnerProfile.image) && !failedImage}
            {@const projectImageUrl =
              winnerProject?.profileImageUrl &&
              winnerProject.profileImageUrl.trim()
                ? winnerProject.profileImageUrl.trim()
                : winnerProfile.image || null}
            <img
              src={projectImageUrl}
              alt={winnerProfile.name || "User"}
              class="founder-avatar"
              onerror={() => {
                failedImage = true;
              }}
            />
          {:else}
            <div class="founder-avatar-placeholder">
              {winnerProfile?.name?.[0] || winnerProject?.userId?.[0] || "?"}
            </div>
          {/if}
        </div>
        <div class="project-info-header">
          <h3 class="project-title">
            {winnerProject?.title || "Winner"}
          </h3>
          <span class="founder-name">{winnerProfile?.name || "Anonymous"}</span>
        </div>
      </div>

      {#if winnerProject?.description}
        <p class="project-description">
          {winnerProject.description}
        </p>
      {/if}

      <!-- More Button -->
      {#if winnerProject?.id}
        <button
          class="project-more-button project-more-button-winner"
          onclick={(e) => {
            e.stopPropagation();
            if (!winnerProject?.id) return;
            try {
              const url = new URL($page.url);
              url.searchParams.set("modal", "project-detail");
              url.searchParams.set("projectId", String(winnerProject.id));
              goto(url.pathname + url.search, {
                replaceState: true,
                noScroll: true,
              });
            } catch (error) {
              console.error("Error opening project modal:", error);
            }
          }}
        >
          View Project
        </button>
      {/if}
    </div>

    <!-- Video Preview Card (16:9) - Always show cover image -->
    {#if videoUrl && isVideoPlaying}
      <!-- Video Playing Inline -->
      <div class="video-card">
        <div class="video-playing-inline">
          <iframe
            src={videoUrl}
            title="Project Pitch Video"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen
            class="video-iframe-inline"
          ></iframe>
          <!-- Close Button Below Video -->
          <div class="video-close-container">
            <button
              class="close-video-btn-bottom"
              onclick={(e) => {
                e.stopPropagation();
                isVideoPlaying = false;
              }}
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
      </div>
    {:else}
      <!-- Video Thumbnail with Play Button (or placeholder if no video) -->
      <div class="video-card">
        <div class="video-thumbnail">
          <!-- Hidden img to detect load errors -->
          <img
            src={thumbnailUrl()}
            alt=""
            style="display: none;"
            onerror={() => {
              failedThumbnail = true;
            }}
          />
          <div
            class="video-thumbnail-bg"
            style="background-image: url('{thumbnailUrl()}')"
          ></div>
          {#if videoUrl}
            <button
              class="play-btn-center play-btn-winner"
              onclick={(e) => {
                e.stopPropagation();
                isVideoPlaying = true;
              }}
              aria-label="Watch {winnerProject?.title || 'project'} pitch"
            >
              <svg class="play-icon" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .winner-card {
    background: #f8f9fa;
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(26, 26, 78, 0.12);
    border: 2px solid rgba(244, 208, 63, 0.3);
    position: relative;
    max-width: 600px;
    margin: 0 auto;
  }

  /* Cup Header Section */
  .cup-header-section {
    background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%);
    padding: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    border-bottom: 3px solid rgba(26, 26, 78, 0.1);
  }

  .cup-header-content {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex: 1;
  }

  .cup-logo {
    width: 48px;
    height: 48px;
    object-fit: contain;
    border-radius: 8px;
    background: white;
    padding: 4px;
  }

  .cup-header-text {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .cup-name {
    font-size: 1.5rem;
    font-weight: 800;
    color: #1a1a4e;
    margin: 0;
    line-height: 1.2;
  }

  .cup-status {
    font-size: 0.75rem;
    font-weight: 700;
    color: rgba(26, 26, 78, 0.7);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .trophy-icon-large {
    font-size: 3rem;
    color: #1a1a4e;
    opacity: 0.8;
    flex-shrink: 0;
  }

  /* Project Card */
  .project-card {
    display: flex;
    flex-direction: column;
    background: white;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
    position: relative;
  }

  .project-card-winner {
    border-top: 4px solid #f4d03f;
    margin: 1rem;
  }

  /* Project Info Section */
  .project-info-section {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    flex: 1 1 auto;
    min-height: 0;
  }

  /* Project Header */
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

  /* More Button */
  .project-more-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 600;
    border-radius: 0.75rem; /* rounded-xl - design system default */
    text-decoration: none;
    transition: all 0.2s ease;
    margin-top: 0.25rem;
    align-self: flex-start;
    border: 2px solid;
    background: white;
    cursor: pointer;
    font-family: inherit;
  }

  .project-more-button-winner {
    background: white;
    color: #f4d03f;
    border-color: #f4d03f;
  }

  .project-more-button-winner:hover {
    background: #f4d03f;
    color: #1a1a4e;
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(244, 208, 63, 0.3);
  }

  /* Video Card */
  .video-card {
    width: 100%;
    flex: 0 0 auto;
    margin-top: auto;
    min-height: 0;
    align-self: flex-end;
    position: relative;
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

  .play-btn-center {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 64px;
    height: 64px;
    background: rgba(244, 208, 63, 0.95);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #1a1a4e;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .play-btn-center:hover {
    background: #f4d03f;
    transform: translate(-50%, -50%) scale(1.1);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
  }

  .play-icon {
    width: 28px;
    height: 28px;
    margin-left: 4px; /* Offset for play triangle */
  }

  /* Video Playing State (Inline) */
  .video-playing-inline {
    position: relative;
    width: 100%;
    background: #000;
    overflow: hidden;
    border-radius: 12px;
  }

  .video-iframe-inline {
    width: 100%;
    height: 600px;
    border: none;
    display: block;
  }

  /* Close Button Container (Below Video) */
  .video-close-container {
    display: flex;
    justify-content: center;
    padding: 1rem 1.5rem;
    background: #000;
    border-radius: 0 0 12px 12px;
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
  }

  /* Tablet Responsive */
  @media (min-width: 769px) and (max-width: 1024px) {
    .winner-card {
      max-width: 750px; /* Wider on tablets */
      margin: 0 auto;
    }

    .cup-header-section {
      padding: 1.75rem;
    }

    .cup-name {
      font-size: 1.75rem;
    }

    .trophy-icon-large {
      font-size: 3.5rem;
    }

    .project-card-winner {
      margin: 1.25rem;
    }

    .project-info-section {
      padding: 1.75rem;
    }

    .project-title {
      font-size: 1.75rem;
    }
  }

  /* Mobile Responsive */
  @media (max-width: 768px) {
    .winner-card {
      border-radius: 16px;
      max-width: 100%; /* Use full width on mobile */
      margin: 0 0.5rem; /* Reduce side margins */
    }

    .cup-header-section {
      padding: 1rem;
    }

    .cup-name {
      font-size: 1.25rem;
    }

    .trophy-icon-large {
      font-size: 2rem;
    }

    .project-card-winner {
      margin: 0.5rem; /* Reduce inner margins for more width */
    }

    .project-info-section {
      padding: 1.25rem;
    }

    .project-title {
      font-size: 1.25rem;
    }

    .project-more-button {
      padding: 0.25rem 0.5rem;
      font-size: 0.6875rem;
    }
  }

  /* Very small mobile devices */
  @media (max-width: 480px) {
    .winner-card {
      margin: 0 0.25rem; /* Even smaller margins on very small screens */
    }

    .project-card-winner {
      margin: 0.375rem; /* Smaller inner margins */
    }
  }
</style>
