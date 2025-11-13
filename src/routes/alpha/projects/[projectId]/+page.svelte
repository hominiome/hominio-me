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
    allProjects,
  } from "$lib/synced-queries";
  import { Button } from "$lib/design-system/atoms";
import Modal from "$lib/Modal.svelte";
import EditProjectContent from "$lib/EditProjectContent.svelte";

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
  // Removed: matches and cups (Cups functionality removed)
  let projects = $state<any[]>([]);
  let showVideoThumbnail = $state(true);
  let isAdmin = $state(false);
  
  // Edit modal state
  const showEditModal = $derived(
    $page.url.searchParams.get("modal") === "edit-project"
  );
  
  function handleEditModalClose() {
    const url = new URL($page.url);
    url.searchParams.delete("modal");
    url.searchParams.delete("projectId");
    goto(url.pathname + url.search, { replaceState: true });
  }

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

      // Removed: matches and cups queries (Cups functionality removed)

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
      if (projectsView) projectsView.destroy();
    };
  });

  function getProjectName(projectId: string) {
    const proj = projects.find((p) => p.id === projectId);
    return proj?.title || "Unknown Project";
  }

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
              <div class="flex gap-2">
                <Button
                  variant="outline"
                  icon="mdi:pencil"
                  iconPosition="left"
                  onclick={() => {
                    const url = new URL($page.url);
                    url.searchParams.set("modal", "edit-project");
                    url.searchParams.set("projectId", projectId);
                    goto(url.pathname + url.search, { replaceState: false });
                  }}
                >
                  Edit
                </Button>
                {#if isAdmin}
                  <Button
                    variant="alert"
                    icon="mdi:delete"
                    iconPosition="left"
                    onclick={() => {
                      goto(
                        `/alpha/projects?modal=delete-project&projectId=${projectId}`,
                        { replaceState: false }
                      );
                    }}
                  >
                    Delete
                  </Button>
                {/if}
              </div>
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
  {/if}
  
  <!-- Edit Project Modal -->
  {#if showEditModal && $session.data?.user && projectId}
    <Modal open={showEditModal} onClose={handleEditModalClose}>
      <EditProjectContent projectId={projectId} onSuccess={handleEditModalClose} />
    </Modal>
  {/if}
</div>
