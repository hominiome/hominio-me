<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { getContext } from "svelte";
  import { authClient } from "$lib/auth.client.js";
  import { getUserProfile } from "$lib/userProfileCache";
  import { getYouTubeEmbedUrl } from "$lib/youtubeUtils";
  import {
    projectById,
    allCups,
    allMatches,
    allProjects,
  } from "$lib/synced-queries";
  import { Button } from "$lib/design-system/atoms";

  const zeroContext = getContext<{
    getInstance: () => any;
    isReady: () => boolean;
  }>("zero");

  const session = authClient.useSession();
  const projectId = $page.params.projectId;

  let zero: any = null;
  let project = $state<any>(null);
  let loading = $state(true);
  let ownerProfile = $state<{
    name: string | null;
    image: string | null;
  } | null>(null);
  let matches = $state<any[]>([]);
  let cups = $state<any[]>([]);
  let projects = $state<any[]>([]);
  let showVideoThumbnail = $state(true);
  let isAdmin = $state(false);

  // Check if user is admin
  $effect(() => {
    (async () => {
      if (!$session.isPending && $session.data?.user) {
        try {
          const response = await fetch("/alpha/api/is-admin");
          if (response.ok) {
            const data = await response.json();
            isAdmin = data.isAdmin;
          }
        } catch (error) {
          console.error("Failed to check admin status:", error);
        }
      }
    })();
  });

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

      // Query project using synced query
      const projectQuery = projectById(projectId);
      projectView = zero.materialize(projectQuery);

      // Query all matches (then filter by projectId in listener)
      const matchesQuery = allMatches();
      const matchesView = zero.materialize(matchesQuery);

      matchesView.addListener((data: any) => {
        // Filter matches where this project participated (either as project1 or project2)
        const allMatchesData = Array.from(data || []);
        matches = allMatchesData.filter(
          (m: any) => m.project1Id === projectId || m.project2Id === projectId
        );
      });

      // Query all cups using synced query
      const cupsQuery = allCups();
      cupsView = zero.materialize(cupsQuery);

      // Query all projects for opponent names using synced query
      const projectsQuery = allProjects();
      projectsView = zero.materialize(projectsQuery);

      projectView.addListener(async (data: any) => {
        const projectsData = Array.from(data || []);
        if (projectsData.length > 0) {
          const newProject = projectsData[0];
          project = newProject;
          // Always show thumbnail initially if there's a videoUrl or we want to show default YouTube
          // Will use fallback thumbnail if custom thumbnail doesn't exist
          showVideoThumbnail = true;

          // Fetch owner profile
          if (newProject && (newProject as any).userId) {
            const profile = await getUserProfile((newProject as any).userId);
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
    if (match.project1Id === projectId || match.project2Id === projectId)
      return "lost";
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
    project?.userId === $session.data?.user?.id || isAdmin
  );

  const canEdit = $derived(
    project &&
      $session.data?.user &&
      (project.userId === $session.data.user.id || isAdmin)
  );

  // Computed values for video/thumbnail
  const videoUrl = $derived(
    project?.videoUrl && project.videoUrl.trim()
      ? project.videoUrl.trim()
      : null
  );

  const thumbnailUrl = $derived(
    project?.bannerImage && project.bannerImage.trim()
      ? project.bannerImage.trim()
      : `https://picsum.photos/seed/${project?.id || "project"}/400/225`
  );

  // Always provide a video embed URL (uses default YouTube if no videoUrl)
  const videoEmbedUrl = $derived(getYouTubeEmbedUrl(videoUrl, false));

  // Check if we should show play button (always true since we have default YouTube fallback)
  const hasVideo = $derived(true);
</script>

<div class="min-h-screen py-8">
  {#if loading}
    <div
      class="bg-white rounded-2xl border-2 border-brand-navy-500/6 shadow-md p-8 text-center"
    >
      <p class="text-brand-navy-700/70">Loading project...</p>
    </div>
  {:else if !project}
    <div
      class="bg-white rounded-2xl border-2 border-brand-navy-500/6 shadow-md p-12 text-center"
    >
      <h1 class="text-3xl font-bold text-brand-navy-500 mb-4">
        Project Not Found
      </h1>
      <p class="text-brand-navy-700/60 mb-6">
        The project you're looking for doesn't exist or has been removed.
      </p>
      <Button variant="primary" onclick={() => goto("/alpha/projects")}>
        Back to Projects
      </Button>
    </div>
  {:else}
    <!-- Back Button -->
    <a
      href="/alpha/projects"
      class="text-brand-teal-500 hover:underline mb-6 inline-block"
    >
      ← Back to Projects
    </a>

    <!-- Full-Width Video/Thumbnail Header -->
    {#if showVideoThumbnail}
      <div class="w-full mb-6 rounded-2xl overflow-hidden">
        <div class="relative w-full aspect-video bg-brand-navy-500/10">
          <img
            src={thumbnailUrl}
            alt={project.title}
            class="w-full h-full object-cover"
            onerror={(e) => {
              const target = e.target as HTMLImageElement;
              if (target)
                target.src = `https://picsum.photos/seed/${project.id || "project"}/400/225`;
            }}
          />
          <button
            class="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors rounded-2xl group"
            title="Play {project.title}"
            onclick={() => {
              showVideoThumbnail = false;
            }}
          >
            <svg
              class="w-20 h-20 text-white group-hover:scale-110 transition-transform"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        </div>
      </div>
    {:else}
      <div class="w-full mb-6 rounded-2xl overflow-hidden">
        <div class="relative w-full aspect-video bg-black">
          <iframe
            src={videoEmbedUrl}
            class="absolute inset-0 w-full h-full"
            title="Project video"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
          ></iframe>
        </div>
      </div>
    {/if}

    <!-- Project Header -->
    <div
      class="bg-white rounded-2xl border-2 border-brand-navy-500/6 shadow-md p-6 md:p-8 mb-6"
    >
      <div class="flex flex-col md:flex-row md:items-start gap-6">
        <div class="flex-1">
          <div class="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1
                class="text-3xl md:text-4xl font-bold text-brand-navy-500 mb-2"
              >
                {project.title}
              </h1>
              {#if project.description}
                <p class="text-brand-navy-700/70 text-lg leading-relaxed">
                  {project.description}
                </p>
              {/if}
            </div>
            {#if canEdit}
              <Button
                variant="outline"
                icon="mdi:pencil"
                iconPosition="left"
                onclick={() => {
                  goto(
                    `/alpha/projects?modal=edit-project&projectId=${projectId}`
                  );
                }}
              >
                Edit
              </Button>
            {/if}
          </div>

          <!-- Project Details -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            {#if ownerProfile}
              <div class="flex flex-col">
                <span
                  class="text-xs font-bold text-brand-navy-500 uppercase tracking-wider mb-1"
                  >Founder</span
                >
                <a
                  href="/alpha/user/{project.userId}"
                  class="text-brand-teal-500 hover:text-brand-navy-500 font-semibold transition-colors"
                >
                  {ownerProfile.name || "Unknown"}
                </a>
              </div>
            {/if}

            {#if project.country}
              <div class="flex flex-col">
                <span
                  class="text-xs font-bold text-brand-navy-500 uppercase tracking-wider mb-1"
                  >Country</span
                >
                <span class="text-brand-navy-700 font-semibold"
                  >{project.country}</span
                >
              </div>
            {/if}

            {#if project.city}
              <div class="flex flex-col">
                <span
                  class="text-xs font-bold text-brand-navy-500 uppercase tracking-wider mb-1"
                  >City</span
                >
                <span class="text-brand-teal-500 font-semibold"
                  >{project.city}</span
                >
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>

    <!-- SDGs -->
    {@const sdgArray = project.sdgs
      ? typeof project.sdgs === "string"
        ? JSON.parse(project.sdgs || "[]")
        : project.sdgs
      : []}
    {#if sdgArray.length > 0}
      <div
        class="bg-white rounded-2xl border-2 border-brand-navy-500/6 shadow-md p-6 md:p-8 mb-6"
      >
        <h2 class="text-xl font-bold text-brand-navy-500 mb-4">
          Sustainable Development Goals
        </h2>
        <div class="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-4">
          {#each sdgArray as sdgId}
            <div class="flex items-center justify-center">
              <img
                src="/sdgs/{sdgId}.svg"
                alt={sdgId}
                class="w-20 h-20 rounded-lg object-cover"
                onerror={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (target) target.style.display = "none";
                }}
              />
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Cups and Matches -->
    {#if matches && matches.length > 0 && Array.from(matchesByCup).length > 0}
      <div
        class="bg-white rounded-2xl border-2 border-brand-navy-500/6 shadow-md p-6 md:p-8 mb-6"
      >
        <h2 class="text-xl font-bold text-brand-navy-500 mb-4">
          Tournament Participation
        </h2>
        {#each Array.from(matchesByCup) as [cupId, cupMatches]}
          <div class="mb-8 last:mb-0">
            <h3
              class="text-lg font-bold text-brand-navy-500 mb-4 pb-2 border-b-2 border-brand-navy-500/10"
            >
              {getCupName(cupId)}
            </h3>
            <div class="flex flex-col gap-3">
              {#each cupMatches as match}
                {@const result = getMatchResult(match)}
                {@const opponentId = getOpponentProject(match)}
                <div
                  class="p-4 rounded-lg border-l-4 transition-all hover:translate-x-1 hover:shadow-md {result ===
                  'won'
                    ? 'bg-success-50 border-success-500'
                    : result === 'lost'
                      ? 'bg-brand-cream-50 border-brand-teal-500/30'
                      : 'bg-brand-cream-50 border-brand-navy-500/20'}"
                >
                  <div class="flex items-center justify-between mb-2">
                    <span
                      class="text-xs font-semibold text-brand-navy-500 uppercase tracking-wider"
                      >{getRoundLabel(match.round)}</span
                    >
                    {#if result === "won"}
                      <span
                        class="px-3 py-1 rounded-xl text-xs font-bold uppercase tracking-wider bg-success-500 text-white"
                        >Won</span
                      >
                    {:else if result === "lost"}
                      <span
                        class="px-3 py-1 rounded-xl text-xs font-bold uppercase tracking-wider bg-brand-teal-500/15 text-brand-navy-700 border border-brand-teal-500/20"
                        >Lost</span
                      >
                    {:else if match.status === "voting"}
                      <span
                        class="px-3 py-1 rounded-xl text-xs font-bold uppercase tracking-wider bg-brand-yellow-500 text-brand-navy-500"
                        >Voting</span
                      >
                    {:else}
                      <span
                        class="px-3 py-1 rounded-xl text-xs font-bold uppercase tracking-wider bg-gray-400 text-white"
                        >Pending</span
                      >
                    {/if}
                  </div>
                  <div class="text-sm text-brand-navy-700 mb-1">
                    vs <a
                      href="/alpha/projects/{opponentId}"
                      class="text-brand-teal-500 hover:text-brand-navy-500 font-semibold transition-colors hover:underline"
                      >{getProjectName(opponentId)}</a
                    >
                  </div>
                  {#if match.completedAt}
                    <div class="text-xs text-brand-navy-700/60">
                      Completed: {new Date(
                        match.completedAt
                      ).toLocaleDateString()}
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
