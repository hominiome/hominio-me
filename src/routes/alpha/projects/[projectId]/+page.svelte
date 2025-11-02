<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { getContext } from "svelte";
  import { authClient } from "$lib/auth.client.js";
  import { getUserProfile } from "$lib/userProfileCache";
  import { getYouTubeEmbedUrl } from "$lib/youtubeUtils";

  const zeroContext = getContext<{
    getInstance: () => any;
    isReady: () => boolean;
  }>("zero");

  const session = authClient.useSession();
  const projectId = $page.params.projectId;

  let zero: any = null;
  let project = $state<any>(null);
  let loading = $state(true);
  let ownerProfile = $state<{ name: string | null; image: string | null } | null>(null);
  let matches = $state<any[]>([]);
  let cups = $state<any[]>([]);
  let projects = $state<any[]>([]);
  let showVideoThumbnail = $state(true);

  onMount(() => {
    let projectView: any;
    let matchesView1: any;
    let matchesView2: any;
    let cupsView: any;
    let projectsView: any;

    (async () => {
      if (!zeroContext) {
        loading = false;
        return;
      }

      // Wait for Zero to be ready
      while (!zeroContext.isReady() || !zeroContext.getInstance()) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      zero = zeroContext.getInstance();

      if (!zero) {
        loading = false;
        return;
      }

      // Query project
      const projectQuery = zero.query.project.where("id", "=", projectId);
      projectView = projectQuery.materialize();

      // Query matches where this project participated
      // We need to query both project1Id and project2Id separately and merge
      const matchesQuery1 = zero.query.cupMatch.where("project1Id", "=", projectId);
      const matchesQuery2 = zero.query.cupMatch.where("project2Id", "=", projectId);
      const matchesView1 = matchesQuery1.materialize();
      const matchesView2 = matchesQuery2.materialize();

      let matches1Data: any[] = [];
      let matches2Data: any[] = [];

      const updateMatches = () => {
        // Merge and deduplicate
        const allMatches = [...matches1Data, ...matches2Data];
        const uniqueMatches = Array.from(
          new Map(allMatches.map((m) => [m.id, m])).values()
        );
        matches = uniqueMatches;
      };

      matchesView1.addListener((data: any) => {
        matches1Data = Array.from(data || []);
        updateMatches();
      });

      matchesView2.addListener((data: any) => {
        matches2Data = Array.from(data || []);
        updateMatches();
      });

      // Query all cups
      const cupsQuery = zero.query.cup;
      cupsView = cupsQuery.materialize();

      // Query all projects for opponent names
      const projectsQuery = zero.query.project;
      projectsView = projectsQuery.materialize();

      projectView.addListener(async (data: any) => {
        const projectsData = Array.from(data || []);
        if (projectsData.length > 0) {
          const newProject = projectsData[0];
          project = newProject;
          // Always show thumbnail initially if there's a videoUrl or we want to show default YouTube
          // Will use fallback thumbnail if custom thumbnail doesn't exist
          showVideoThumbnail = true;

          // Fetch owner profile
          if (newProject.userId) {
            const profile = await getUserProfile(newProject.userId);
            ownerProfile = { name: profile.name, image: profile.image };
          }
        }
      });


      cupsView.addListener((data: any) => {
        cups = Array.from(data || []);
      });

      projectsView.addListener((data: any) => {
        projects = Array.from(data || []);
      });

      // Set loading to false after initial load
      setTimeout(() => {
        loading = false;
      }, 500);
    })();

    return () => {
      if (projectView) projectView.destroy();
      if (matchesView1) matchesView1.destroy();
      if (matchesView2) matchesView2.destroy();
      if (cupsView) cupsView.destroy();
      if (projectsView) projectsView.destroy();
    };
  });

  function getRoundLabel(round: string) {
    switch (round) {
      case "round_4":
        return "Round of 4";
      case "round_8":
        return "Round of 8";
      case "round_16":
        return "Round of 16";
      case "round_32":
        return "Round of 32";
      case "round_64":
        return "Round of 64";
      case "round_128":
        return "Round of 128";
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

  function getCupName(cupId: string) {
    const cup = cups.find((c) => c.id === cupId);
    return cup?.name || cupId;
  }

  function getProjectName(projectId: string) {
    const proj = projects.find((p) => p.id === projectId);
    return proj?.title || "Unknown Project";
  }

  function getMatchResult(match: any) {
    if (match.status !== "completed") return null;
    if (match.winnerId === projectId) return "won";
    if (match.project1Id === projectId || match.project2Id === projectId) return "lost";
    return null;
  }

  function getOpponentProject(match: any) {
    if (match.project1Id === projectId) return match.project2Id;
    if (match.project2Id === projectId) return match.project1Id;
    return null;
  }

  // Group matches by cup
  const matchesByCup = $derived.by(() => {
    const grouped = new Map<string, any[]>();
    if (matches && matches.length > 0) {
      matches.forEach((match) => {
        if (match && match.cupId) {
          if (!grouped.has(match.cupId)) {
            grouped.set(match.cupId, []);
          }
          grouped.get(match.cupId)!.push(match);
        }
      });
    }
    return grouped;
  });

  const isOwner = $derived(
    project?.userId === $session.data?.user?.id
  );

  // Computed values for video/thumbnail
  const videoUrl = $derived(
    project?.videoUrl && project.videoUrl.trim() ? project.videoUrl.trim() : null
  );

  const thumbnailUrl = $derived(
    project?.videoThumbnail && project.videoThumbnail.trim()
      ? project.videoThumbnail.trim()
      : `https://picsum.photos/seed/${project?.id || 'project'}/400/225`
  );

  // Always provide a video embed URL (uses default YouTube if no videoUrl)
  const videoEmbedUrl = $derived(
    getYouTubeEmbedUrl(videoUrl, false)
  );

  // Check if we should show play button (always true since we have default YouTube fallback)
  const hasVideo = $derived(true);
</script>

<div class="min-h-screen bg-cream p-4 md:p-8">
  <div class="max-w-4xl mx-auto">
    {#if loading}
      <div class="card p-8 text-center">
        <p class="text-navy/70">Loading project...</p>
      </div>
    {:else if !project}
      <div class="card p-12 text-center">
        <h1 class="text-3xl font-bold text-navy mb-4">Project Not Found</h1>
        <p class="text-navy/60 mb-6">
          The project you're looking for doesn't exist or has been removed.
        </p>
        <a href="/alpha/projects" class="btn-primary">
          Back to Projects
        </a>
      </div>
    {:else}
      <!-- Back Button -->
      <a href="/alpha/projects" class="text-teal hover:underline mb-6 inline-block">
        ← Back to Projects
      </a>

      <!-- Full-Width Video/Thumbnail Header -->
      {#if showVideoThumbnail}
        <div class="video-header-full-width mb-6">
          <div class="video-thumbnail-full-width">
            <img
              src={thumbnailUrl}
              alt={project.title}
              class="video-thumbnail-img-full"
              onerror={(e) => {
                e.target.src = `https://picsum.photos/seed/${project.id || 'project'}/400/225`;
              }}
            />
            <button
              class="video-play-button-full"
              title="Play {project.title}"
              onclick={() => {
                showVideoThumbnail = false;
              }}
            >
              <svg class="play-icon-full" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          </div>
        </div>
      {:else}
        <div class="video-header-full-width mb-6">
          <div class="video-embed-full-width">
            <iframe
              src={videoEmbedUrl}
              class="video-iframe-full-width"
              title="Project video"
              frameborder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen
            ></iframe>
          </div>
        </div>
      {/if}

      <!-- Project Header -->
      <div class="card p-6 md:p-8 mb-6">
        <div class="flex flex-col md:flex-row md:items-start gap-6">

          <div class="flex-1">
            <div class="flex items-start justify-between gap-4 mb-4">
              <div>
                <h1 class="text-3xl md:text-4xl font-bold text-navy mb-2">
                  {project.title}
                </h1>
                {#if project.description}
                  <p class="text-navy/70 text-lg leading-relaxed">
                    {project.description}
                  </p>
                {/if}
              </div>
              {#if isOwner}
                <a
                  href="/alpha/projects?modal=edit-project&projectId={projectId}"
                  class="btn-secondary flex-shrink-0"
                >
                  Edit
                </a>
              {/if}
            </div>

            <!-- Project Details -->
            <div class="project-details-grid">
              {#if ownerProfile}
                <div class="detail-item">
                  <span class="detail-label">Founder</span>
                  <a
                    href="/alpha/user/{project.userId}"
                    class="detail-value detail-link"
                  >
                    {ownerProfile.name || "Unknown"}
                  </a>
                </div>
              {/if}

              {#if project.country}
                <div class="detail-item">
                  <span class="detail-label">Country</span>
                  <span class="detail-value">{project.country}</span>
                </div>
              {/if}

              {#if project.city}
                <div class="detail-item">
                  <span class="detail-label">City</span>
                  <span class="detail-value">{project.city}</span>
                </div>
              {/if}
            </div>
          </div>
        </div>
      </div>

      <!-- SDGs -->
      {@const sdgArray = project.sdgs ? (typeof project.sdgs === "string" ? JSON.parse(project.sdgs || "[]") : project.sdgs) : []}
      {#if sdgArray.length > 0}
        <div class="card p-6 md:p-8 mb-6">
          <h2 class="text-xl font-bold text-navy mb-4">Sustainable Development Goals</h2>
          <div class="sdgs-grid">
            {#each sdgArray as sdgId}
              <div class="sdg-item">
                <img
                  src="/sdgs/{sdgId}.svg"
                  alt={sdgId}
                  class="sdg-icon"
                  onerror={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Cups and Matches -->
      {#if matches && matches.length > 0 && Array.from(matchesByCup).length > 0}
        <div class="card p-6 md:p-8 mb-6">
          <h2 class="text-xl font-bold text-navy mb-4">Tournament Participation</h2>
          {#each Array.from(matchesByCup) as [cupId, cupMatches]}
            <div class="cup-section">
              <h3 class="cup-section-title">{getCupName(cupId)}</h3>
              <div class="matches-list">
                {#each cupMatches as match}
                  {@const result = getMatchResult(match)}
                  {@const opponentId = getOpponentProject(match)}
                  <div class="match-item {result}">
                    <div class="match-header">
                      <span class="match-round">{getRoundLabel(match.round)}</span>
                      {#if result === "won"}
                        <span class="match-result won">Won</span>
                      {:else if result === "lost"}
                        <span class="match-result lost">Lost</span>
                      {:else if match.status === "voting"}
                        <span class="match-result voting">Voting</span>
                      {:else}
                        <span class="match-result pending">Pending</span>
                      {/if}
                    </div>
                    <div class="match-opponent">
                      vs <a href="/alpha/projects/{opponentId}" class="opponent-link">{getProjectName(opponentId)}</a>
                    </div>
                    {#if match.completedAt}
                      <div class="match-date">
                        Completed: {new Date(match.completedAt).toLocaleDateString()}
                      </div>
                    {/if}
                  </div>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .bg-cream {
    background-color: #fef9f0;
  }

  .card {
    background: white;
    border-radius: 16px;
    box-shadow: 0 2px 12px rgba(26, 26, 78, 0.06);
    border: 1px solid rgba(26, 26, 78, 0.08);
  }

  .btn-primary {
    padding: 0.75rem 1.5rem;
    background: linear-gradient(135deg, #4ecdc4 0%, #1a1a4e 100%);
    color: white;
    border-radius: 12px;
    font-weight: 600;
    text-decoration: none;
    display: inline-block;
    transition: all 0.2s;
  }

  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(78, 205, 196, 0.3);
  }

  .btn-secondary {
    padding: 0.75rem 1.5rem;
    background: white;
    color: #1a1a4e;
    border: 2px solid rgba(26, 26, 78, 0.1);
    border-radius: 12px;
    font-weight: 600;
    text-decoration: none;
    display: inline-block;
    transition: all 0.2s;
  }

  .btn-secondary:hover {
    border-color: #4ecdc4;
    color: #4ecdc4;
    transform: translateY(-2px);
  }

  .text-navy {
    color: #1a1a4e;
  }

  .text-teal {
    color: #4ecdc4;
  }

  .project-thumbnail-detail {
    flex-shrink: 0;
  }

  .thumbnail-image {
    width: 100%;
    max-width: 500px;
    height: auto;
    border-radius: 12px;
    object-fit: cover;
  }

  .video-thumbnail {
    width: 100%;
    max-width: 500px;
    height: auto;
    border-radius: 12px;
    object-fit: cover;
    display: block;
  }

  @media (min-width: 768px) {
    .thumbnail-image,
    .video-thumbnail {
      max-width: 400px;
    }
  }

  .project-details-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
    margin-top: 1.5rem;
  }

  .detail-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .detail-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: rgba(26, 26, 78, 0.6);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .detail-value {
    font-size: 0.9375rem;
    font-weight: 600;
    color: #1a1a4e;
  }

  .detail-link {
    text-decoration: none;
    transition: color 0.2s;
  }

  .detail-link:hover {
    color: #4ecdc4;
    text-decoration: underline;
  }

  .sdgs-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: 1rem;
  }

  .sdg-item {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem;
    background: #f9fafb;
    border-radius: 8px;
  }

  .sdg-icon {
    width: 60px;
    height: 60px;
    object-fit: contain;
  }

  .video-container {
    flex-shrink: 0;
    width: 100%;
    max-width: 500px;
  }

  @media (min-width: 768px) {
    .video-container {
      max-width: 400px;
    }
  }

  /* Full-width video/thumbnail header */
  .video-header-full-width {
    width: 100%;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(26, 26, 78, 0.12);
  }

  .video-thumbnail-full-width {
    position: relative;
    width: 100%;
    padding-bottom: 56.25%; /* 16:9 aspect ratio */
    height: 0;
    overflow: hidden;
    background: #000;
  }

  .video-thumbnail-img-full {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .video-play-button-full {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 80px;
    height: 80px;
    background: rgba(0, 0, 0, 0.7);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    border: none;
    cursor: pointer;
    transition: all 0.3s;
    backdrop-filter: blur(4px);
  }

  .video-play-button-full:hover {
    background: rgba(0, 0, 0, 0.9);
    transform: translate(-50%, -50%) scale(1.1);
  }

  .play-icon-full {
    width: 40px;
    height: 40px;
    margin-left: 4px; /* Center the triangle */
  }

  .video-embed-full-width {
    position: relative;
    padding-bottom: 56.25%; /* 16:9 aspect ratio */
    height: 0;
    overflow: hidden;
    background: #000;
  }

  .video-iframe-full-width {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border: none;
  }

  .video-wrapper {
    position: relative;
    width: 100%;
    border-radius: 12px;
    overflow: hidden;
  }

  .video-thumbnail {
    width: 100%;
    height: auto;
    display: block;
    border-radius: 12px;
  }

  .video-play-button {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 64px;
    height: 64px;
    background: rgba(0, 0, 0, 0.7);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    text-decoration: none;
    transition: all 0.3s;
    backdrop-filter: blur(4px);
  }

  .video-play-button:hover {
    background: rgba(0, 0, 0, 0.9);
    transform: translate(-50%, -50%) scale(1.1);
  }

  .play-icon {
    width: 32px;
    height: 32px;
    margin-left: 4px; /* Center the triangle */
  }

  .video-embed {
    position: relative;
    padding-bottom: 56.25%; /* 16:9 aspect ratio */
    height: 0;
    overflow: hidden;
    border-radius: 12px;
  }

  .video-iframe {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border: none;
  }

  .video-link-button {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    background: linear-gradient(135deg, #4ecdc4 0%, #1a1a4e 100%);
    color: white;
    border-radius: 12px;
    text-decoration: none;
    font-weight: 600;
    transition: all 0.3s;
    box-shadow: 0 4px 12px rgba(78, 205, 196, 0.3);
  }

  .video-link-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(78, 205, 196, 0.4);
  }

  .video-link-icon {
    width: 24px;
    height: 24px;
  }

  .cup-section {
    margin-bottom: 2rem;
  }

  .cup-section:last-child {
    margin-bottom: 0;
  }

  .cup-section-title {
    font-size: 1.125rem;
    font-weight: 700;
    color: #1a1a4e;
    margin-bottom: 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 2px solid rgba(26, 26, 78, 0.1);
  }

  .matches-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .match-item {
    padding: 1rem;
    background: #f9fafb;
    border-radius: 8px;
    border-left: 4px solid rgba(26, 26, 78, 0.2);
    transition: all 0.2s;
  }

  .match-item.won {
    border-left-color: #10b981;
    background: #f0fdf4;
  }

  .match-item.lost {
    background: linear-gradient(135deg, #f8f9fa 0%, #f5f5f5 100%);
    border-left: 3px solid rgba(78, 205, 196, 0.3);
  }

  .match-item:hover {
    transform: translateX(4px);
    box-shadow: 0 2px 8px rgba(26, 26, 78, 0.1);
  }

  .match-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }

  .match-round {
    font-size: 0.875rem;
    font-weight: 600;
    color: #1a1a4e;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .match-result {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .match-result.won {
    background: #10b981;
    color: white;
  }

  .match-result.lost {
    background: rgba(78, 205, 196, 0.15);
    color: rgba(26, 26, 78, 0.7);
    border: 1px solid rgba(78, 205, 196, 0.2);
  }

  .match-result.voting {
    background: #f4d03f;
    color: #1a1a4e;
  }

  .match-result.pending {
    background: #9ca3af;
    color: white;
  }

  .match-opponent {
    font-size: 0.9375rem;
    color: #4b5563;
    margin-bottom: 0.25rem;
  }

  .opponent-link {
    color: #4ecdc4;
    text-decoration: none;
    font-weight: 600;
    transition: color 0.2s;
  }

  .opponent-link:hover {
    color: #1a1a4e;
    text-decoration: underline;
  }

  .match-date {
    font-size: 0.75rem;
    color: #6b7280;
  }

  @media (max-width: 640px) {
    .project-details-grid {
      grid-template-columns: 1fr;
    }

    .video-container {
      max-width: 100%;
    }
  }
</style>

