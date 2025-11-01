<script lang="ts">
  import { nanoid } from "nanoid";
  import { getContext } from "svelte";
  import { onMount } from "svelte";
  import { authClient } from "$lib/auth.client.js";
  import { getUserProfile, prefetchUserProfiles } from "$lib/userProfileCache";
  import UserAutocomplete from "$lib/UserAutocomplete.svelte";
  import { showError } from "$lib/toastStore.js";
  import ConfirmDialog from "$lib/ConfirmDialog.svelte";

  // Get Zero instance from context (initialized in layout)
  const zeroContext = getContext<{
    getInstance: () => any;
    isReady: () => boolean;
  }>("zero");

  let zero: any = null;
  let projects = $state<any[]>([]);
  let loading = $state(true);
  let showCreateForm = $state(false);
  let isAdmin = $state(false);
  let userProfiles = $state<
    Map<string, { name: string | null; image: string | null }>
  >(new Map());
  // Track which user images have failed to load
  let failedImages = $state<Set<string>>(new Set());

  // Form state
  let newProject = $state({
    title: "",
    description: "",
    city: "",
    videoUrl: "",
    sdgs: [] as string[],
  });
  let selectedOwner = $state<{ id: string; name: string | null; image: string | null } | null>(null);

  // All available SDGs
  const availableSDGs = [
    { id: "01_NoPoverty", name: "No Poverty" },
    { id: "02_ZeroHunger", name: "Zero Hunger" },
    { id: "03_GoodHealth", name: "Good Health" },
    { id: "04_QualityEducation", name: "Quality Education" },
    { id: "05_GenderEquality", name: "Gender Equality" },
    { id: "06_CleanWaterSanitation", name: "Clean Water & Sanitation" },
    { id: "07_CleanEnergy", name: "Clean Energy" },
    { id: "08_DecentWork", name: "Decent Work" },
    { id: "09_Industry", name: "Industry & Innovation" },
    { id: "10_ReducedInequalities", name: "Reduced Inequalities" },
    { id: "11_SustainableCities", name: "Sustainable Cities" },
    { id: "12_ResponsibleConsumption", name: "Responsible Consumption" },
    { id: "13_Climate", name: "Climate Action" },
    { id: "14_LifeBelowWater", name: "Life Below Water" },
    { id: "15_LifeOnLand", name: "Life On Land" },
    { id: "16_PeaceJusticeInstitutions", name: "Peace & Justice" },
    { id: "17_Partnerships", name: "Partnerships" },
  ];

  function toggleSDG(sdgId: string) {
    if (newProject.sdgs.includes(sdgId)) {
      newProject.sdgs = newProject.sdgs.filter((id) => id !== sdgId);
    } else {
      if (newProject.sdgs.length < 3) {
        newProject.sdgs = [...newProject.sdgs, sdgId];
      }
    }
  }

  const session = authClient.useSession();

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
    if (!zeroContext) {
      console.error("Zero context not found");
      loading = false;
      return;
    }

    let projectsView: any;

    // Wait for Zero to be ready
    const checkZero = setInterval(() => {
      if (zeroContext.isReady() && zeroContext.getInstance()) {
        clearInterval(checkZero);
        zero = zeroContext.getInstance();

        // Query ALL projects (everyone can read)
        const projectsQuery = zero.query.project.orderBy("createdAt", "desc");
        projectsView = projectsQuery.materialize();

        projectsView.addListener(async (data: any) => {
          const newProjects = Array.from(data);
          projects = newProjects;
          loading = false;

          // Fetch user profiles for all projects
          const userIds = [
            ...new Set(newProjects.map((p: any) => p.userId).filter(Boolean)),
          ];
          if (userIds.length > 0) {
            await prefetchUserProfiles(userIds);
            // Update userProfiles map
            const newUserProfiles = new Map(userProfiles);
            for (const userId of userIds) {
              const profile = await getUserProfile(userId);
              newUserProfiles.set(userId, {
                name: profile.name,
                image: profile.image,
              });
            }
            userProfiles = newUserProfiles; // Trigger reactivity
          }
        });
      }
    }, 100);

    return () => {
      clearInterval(checkZero);
      if (projectsView) projectsView.destroy();
    };
  });

  async function createProject() {
    if (!zero || !$session.data?.user) return;
    if (
      !newProject.title.trim() ||
      !newProject.description.trim() ||
      !newProject.city.trim() ||
      newProject.sdgs.length === 0
    )
      return;

    // Use selected owner if admin selected one, otherwise use current user
    const ownerId = isAdmin && selectedOwner ? selectedOwner.id : $session.data.user.id;

    await zero.mutate.project.insert({
      id: nanoid(),
      title: newProject.title,
      description: newProject.description,
      city: newProject.city,
      videoUrl: newProject.videoUrl.trim() || "",
      userId: ownerId,
      sdgs: JSON.stringify(newProject.sdgs),
      createdAt: new Date().toISOString(),
    });

    // Reset form
    newProject = {
      title: "",
      description: "",
      city: "",
      videoUrl: "",
      sdgs: [],
    };
    selectedOwner = null;
    showCreateForm = false;
  }

  let showDeleteConfirm = $state(false);
  let projectToDelete = $state<string | null>(null);

  function requestDeleteProject(id: string) {
    if (!zero || !$session.data?.user) return;

    // Find the project to verify ownership (client-side check for UX)
    const project = projects.find((p) => p.id === id);
    if (!project || project.userId !== $session.data.user.id) {
      showError("You can only delete your own projects.");
      return;
    }

    projectToDelete = id;
    showDeleteConfirm = true;
  }

  async function confirmDeleteProject() {
    if (!projectToDelete || !zero) return;

    // Zero server will also enforce this permission server-side
    await zero.mutate.project.delete({ id: projectToDelete });
    projectToDelete = null;
    showDeleteConfirm = false;
  }

  function isMyProject(project: any) {
    return project.userId === $session.data?.user?.id;
  }

  function canEditProject(project: any) {
    return isAdmin || isMyProject(project);
  }
</script>

<div class="min-h-screen bg-cream p-8">
  {#if $session.isPending || loading}
    <div class="flex items-center justify-center min-h-screen">
      <div class="card p-8">
        <p class="text-navy/70">Loading projects...</p>
      </div>
    </div>
  {:else}
    <div class="max-w-7xl mx-auto">
      <!-- Header -->
      <div class="mb-6">
        <div class="flex justify-between items-center">
          <div>
            <h1 class="text-4xl font-bold text-navy mb-1">Projects</h1>
            <p class="text-navy/60 text-sm">
              Explore amazing projects from around the world
            </p>
          </div>
          {#if $session.data?.user}
            <button
              onclick={() => (showCreateForm = !showCreateForm)}
              class="btn-primary px-5 py-2 text-sm"
            >
              <span class="text-lg mr-1">+</span>
              New Project
            </button>
          {/if}
        </div>
      </div>

      <!-- Create Form Modal -->
      {#if showCreateForm}
        <div
          class="modal-overlay"
          role="dialog"
          aria-modal="true"
          tabindex="-1"
          onclick={(e) => {
            if (e.target === e.currentTarget) showCreateForm = false;
          }}
          onkeydown={(e) => {
            if (e.key === "Escape") showCreateForm = false;
          }}
        >
          <div class="modal-content">
            <button
              onclick={() => (showCreateForm = false)}
              class="absolute top-4 right-4 text-navy/40 hover:text-navy text-3xl leading-none"
            >
              ×
            </button>
            <h2 class="text-3xl font-bold text-navy mb-6">
              Create New Project
            </h2>
            <form
              onsubmit={(e) => {
                e.preventDefault();
                createProject();
              }}
              class="space-y-5"
            >
              <div>
                <label
                  for="project-title"
                  class="block text-navy/80 font-medium mb-2">Title</label
                >
                <input
                  id="project-title"
                  type="text"
                  bind:value={newProject.title}
                  placeholder="My Amazing Project"
                  class="input w-full"
                  required
                />
              </div>
              <div>
                <label
                  for="project-description"
                  class="block text-navy/80 font-medium mb-2">Description</label
                >
                <textarea
                  id="project-description"
                  bind:value={newProject.description}
                  placeholder="Tell us about your project..."
                  rows="4"
                  class="input w-full"
                  required
                ></textarea>
              </div>
              <div>
                <label
                  for="project-city"
                  class="block text-navy/80 font-medium mb-2">City</label
                >
                <input
                  id="project-city"
                  type="text"
                  bind:value={newProject.city}
                  placeholder="San Francisco"
                  class="input w-full"
                  required
                />
              </div>

              <!-- Video URL (Optional) -->
              <div>
                <label
                  for="project-videoUrl"
                  class="block text-navy/80 font-medium mb-2"
                >
                  YouTube Video URL (Optional)
                </label>
                <input
                  id="project-videoUrl"
                  type="url"
                  bind:value={newProject.videoUrl}
                  placeholder="https://www.youtube.com/watch?v=..."
                  class="input w-full"
                />
                <p class="text-sm text-navy/60 mt-1">
                  Add a YouTube link for your project pitch video
                </p>
              </div>

              <!-- Project Owner (Admin Only) -->
              {#if isAdmin}
                <div>
                  <UserAutocomplete
                    bind:value={selectedOwner}
                    label="Project Owner"
                    placeholder="Search for a user..."
                  />
                  <p class="text-sm text-navy/60 mt-1">
                    Select project owner (optional, defaults to you)
                  </p>
                </div>
              {/if}

              <!-- SDG Selection -->
              <div>
                <label
                  for="project-sdgs"
                  class="block text-navy/80 font-medium mb-2"
                >
                  Sustainable Development Goals (Select 1-3) *
                </label>
                <p class="text-sm text-navy/60 mb-3">
                  Selected: {newProject.sdgs.length}/3
                </p>
                <div class="sdg-grid">
                  {#each availableSDGs as sdg}
                    <button
                      type="button"
                      onclick={() => toggleSDG(sdg.id)}
                      class="sdg-selector {newProject.sdgs.includes(sdg.id)
                        ? 'selected'
                        : ''}"
                      disabled={!newProject.sdgs.includes(sdg.id) &&
                        newProject.sdgs.length >= 3}
                      title={sdg.name}
                    >
                      <img
                        src="/sdgs/{sdg.id}.svg"
                        alt={sdg.name}
                        class="sdg-image"
                      />
                      {#if newProject.sdgs.includes(sdg.id)}
                        <div class="sdg-checkmark">✓</div>
                      {/if}
                    </button>
                  {/each}
                </div>
              </div>

              <div class="flex gap-3 pt-2">
                <button type="submit" class="btn-primary px-8 py-3 flex-1">
                  Create Project
                </button>
                <button
                  type="button"
                  onclick={() => (showCreateForm = false)}
                  class="btn-secondary px-8 py-3"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      {/if}

      <!-- Grid View Layout -->
      {#if projects.length === 0}
        <div class="card p-16">
          <div class="text-center">
            <p class="text-navy/50 text-lg">
              No projects yet. Create the first one!
            </p>
          </div>
        </div>
      {:else}
        <div class="projects-list">
          {#each projects as project (project.id)}
            {@const userProfile = userProfiles.get(project.userId)}
            {@const thumbnailUrl = project.videoThumbnail && typeof project.videoThumbnail === 'string' && project.videoThumbnail.trim().length > 0 
              ? project.videoThumbnail.trim() 
              : `https://picsum.photos/seed/${project.id || 'project'}/400/225`}
            <div class="project-list-card">
              <!-- Top Section: Thumbnail and Content Side by Side -->
              <div class="project-list-card-top-section">
                <!-- Thumbnail on Left -->
                <div class="project-thumbnail-container">
                  <img
                    src={thumbnailUrl}
                    alt={project.title}
                    class="project-thumbnail"
                    onerror={(e) => {
                      e.target.src = `https://picsum.photos/seed/${project.id || 'project'}/400/225`;
                    }}
                  />
                </div>

                <!-- Main Content Area -->
                <div class="project-main-content">
                <!-- Content Section -->
                <div class="project-content">
                  <!-- Card Header -->
                  <div class="flex justify-between items-start mb-3">
                    <h3 class="text-2xl font-bold text-navy leading-tight">{project.title}</h3>
                    {#if isMyProject(project)}
                      <span class="badge">Yours</span>
                    {/if}
                  </div>

                  <!-- Founder Info -->
                  <a href="/alpha/user/{project.userId}" class="founder-link">
                    <div class="flex items-center gap-2.5 mb-3">
                      {#if userProfile?.image && !failedImages.has(project.userId)}
                        <img
                          src={userProfile.image}
                          alt={userProfile.name || "User"}
                          class="founder-avatar"
                          onerror={() => {
                            failedImages = new Set(failedImages).add(
                              project.userId
                            );
                          }}
                        />
                      {:else}
                        <div class="founder-avatar-placeholder">
                          {userProfile?.name?.[0] || project.userId?.[0] || "?"}
                        </div>
                      {/if}
                      <span class="founder-name"
                        >{userProfile?.name || "Anonymous"}</span
                      >
                    </div>
                  </a>

                  <!-- City -->
                  <div
                    class="flex items-center gap-2 text-teal text-sm font-medium mb-4"
                  >
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fill-rule="evenodd"
                        d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                        clip-rule="evenodd"
                      />
                    </svg>
                    {project.city}
                  </div>

                  <!-- Description -->
                  <p class="text-navy/70 text-sm leading-relaxed mb-4 line-clamp-3">
                    {project.description}
                  </p>
                </div>

                <!-- SDGs Display - Vertical on Right -->
                {#if project.sdgs}
                  {@const sdgArray =
                    typeof project.sdgs === "string"
                      ? JSON.parse(project.sdgs || "[]")
                      : project.sdgs}
                  {#if sdgArray.length > 0}
                    <div class="project-sdgs-sidebar">
                      <div class="sdg-display-vertical">
                        {#each sdgArray as sdgId}
                          <img
                            src="/sdgs/{sdgId}.svg"
                            alt={sdgId}
                            class="sdg-badge-vertical"
                            title={availableSDGs.find((s) => s.id === sdgId)
                              ?.name || sdgId}
                          />
                        {/each}
                      </div>
                    </div>
                  {/if}
                {/if}
                </div>
              </div>

              <!-- Footer with Actions - Below Full Width Line -->
              {#if canEditProject(project)}
                <div class="project-footer">
                  <div class="project-footer-line"></div>
                  <div class="project-footer-actions">
                    <a
                      href="/alpha/projects/{project.id}/edit"
                      class="btn-edit-small"
                    >
                      <svg
                        class="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                      Edit
                    </a>
                    {#if isMyProject(project)}
                      <button
                        onclick={() => requestDeleteProject(project.id)}
                        class="btn-danger-small"
                      >
                        Delete
                      </button>
                    {/if}
                  </div>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  <!-- Delete Confirmation Dialog -->
  <ConfirmDialog
    bind:open={showDeleteConfirm}
    title="Delete Project"
    message="Are you sure you want to delete this project? This action cannot be undone."
    confirmText="Delete"
    cancelText="Cancel"
    variant="danger"
    onConfirm={confirmDeleteProject}
  />
</div>

<style>
  /* Color Palette from Logo */
  :global(.bg-cream) {
    background-color: #faf9f6;
  }

  :global(.text-navy) {
    color: #1a1a4e;
  }

  :global(.text-teal) {
    color: #4ecdc4;
  }

  :global(.text-yellow) {
    color: #f4d03f;
  }

  :global(.bg-yellow) {
    background-color: #f4d03f;
  }

  :global(.border-yellow) {
    border-color: #f4d03f;
  }

  :global(.from-yellow-50) {
    --tw-gradient-from: #fffbeb;
  }

  :global(.to-amber-50) {
    --tw-gradient-to: #fffbeb;
  }

  /* Projects List Container */
  .projects-list {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    width: 100%;
  }

  /* Project List Card - Full Width with Thumbnail on Left */
  .project-list-card {
    background: white;
    border-radius: 16px;
    border: 2px solid rgba(26, 26, 78, 0.06);
    padding: 0;
    transition: all 0.3s ease;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    width: 100%;
    min-height: 240px;
  }

  /* Top Section - Thumbnail and Main Content Side by Side */
  .project-list-card-top-section {
    display: flex;
    flex: 1;
    min-height: 240px;
  }

  .project-list-card:hover {
    border-color: rgba(78, 205, 196, 0.4);
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(78, 205, 196, 0.15);
  }

  /* Thumbnail Container */
  .project-thumbnail-container {
    flex-shrink: 0;
    width: 280px;
    min-width: 280px;
    overflow: hidden;
    background: rgba(26, 26, 78, 0.05);
    position: relative;
    display: flex;
    align-items: stretch;
  }

  .project-thumbnail {
    width: 100%;
    height: 100%;
    min-height: 240px;
    object-fit: cover;
    display: block;
  }

  /* Main Content Area - Contains content and SDGs */
  .project-main-content {
    display: flex;
    flex: 1;
    min-height: 240px;
  }

  /* Content Container */
  .project-content {
    flex: 1;
    padding: 2rem;
    display: flex;
    flex-direction: column;
  }

  /* SDGs Sidebar - Vertical on Right */
  .project-sdgs-sidebar {
    flex-shrink: 0;
    width: 80px;
    padding: 2rem 2rem 2rem 1rem;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    justify-content: flex-start;
  }

  .sdg-display-vertical {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    align-items: flex-end;
  }

  .sdg-badge-vertical {
    width: 60px;
    height: 60px;
    min-width: 60px;
    min-height: 60px;
    aspect-ratio: 1 / 1;
    border-radius: 8px;
    object-fit: cover;
    display: block;
  }

  /* Footer Section */
  .project-footer {
    width: 100%;
    padding: 0 2rem 1.5rem 2rem;
  }

  .project-footer-line {
    width: 100%;
    height: 1px;
    background: rgba(26, 26, 78, 0.1);
    margin-bottom: 1rem;
  }

  .project-footer-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
  }

  @media (max-width: 768px) {
    .project-list-card {
      min-height: auto;
    }

    .project-list-card-top-section {
      flex-direction: column;
      min-height: auto;
    }

    .project-main-content {
      flex-direction: column;
      min-height: auto;
    }

    .project-thumbnail-container {
      width: 100%;
      min-width: 100%;
      height: 200px;
    }

    .project-content {
      padding: 1.5rem;
    }

    .project-sdgs-sidebar {
      width: 100%;
      padding: 1rem 1.5rem;
      align-items: flex-start;
    }

    .sdg-display-vertical {
      flex-direction: row;
      flex-wrap: wrap;
      align-items: flex-start;
    }

    .project-footer {
      padding: 0 1.5rem 1.5rem 1.5rem;
    }
  }

  /* Founder Info */
  .founder-link {
    text-decoration: none;
    display: inline-block;
    transition: all 0.2s ease;
  }

  .founder-link:hover {
    transform: translateX(4px);
  }

  .founder-link:hover .founder-name {
    color: #4ecdc4;
  }

  .founder-link:hover .founder-avatar {
    border-color: #f4d03f;
  }

  .founder-link:hover .founder-avatar-placeholder {
    border-color: #f4d03f;
  }

  .founder-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 2px solid #4ecdc4;
    object-fit: cover;
    transition: border-color 0.2s ease;
  }

  .founder-avatar-placeholder {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 2px solid #4ecdc4;
    background: linear-gradient(135deg, #4ecdc4, #f4d03f);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 700;
    font-size: 1.125rem;
    text-transform: uppercase;
    transition: border-color 0.2s ease;
  }

  .founder-name {
    color: #1a1a4e;
    font-weight: 600;
    font-size: 0.875rem;
    transition: color 0.2s ease;
  }

  /* Cards */
  .card {
    background: white;
    border-radius: 16px;
    border: 1px solid rgba(26, 26, 78, 0.08);
    box-shadow: 0 2px 12px rgba(26, 26, 78, 0.06);
    transition: all 0.3s ease;
  }


  .card:hover {
    box-shadow: 0 4px 20px rgba(26, 26, 78, 0.1);
  }

  /* Buttons */
  .btn-primary {
    background: #1a1a4e;
    color: white;
    border-radius: 12px;
    font-weight: 600;
    transition: all 0.2s ease;
    border: none;
  }

  .btn-primary:hover {
    background: #2a2a6e;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(26, 26, 78, 0.3);
  }

  .btn-secondary {
    background: white;
    color: #1a1a4e;
    border-radius: 12px;
    border: 2px solid rgba(26, 26, 78, 0.1);
    font-weight: 600;
    transition: all 0.2s ease;
  }

  .btn-secondary:hover {
    border-color: #4ecdc4;
    color: #4ecdc4;
  }

  .btn-edit-small {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: white;
    color: #1a1a4e;
    border: 2px solid rgba(26, 26, 78, 0.1);
    border-radius: 8px;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    transition: all 0.2s ease;
    cursor: pointer;
    text-decoration: none;
  }

  .btn-edit-small:hover {
    border-color: #4ecdc4;
    color: #4ecdc4;
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(78, 205, 196, 0.2);
  }

  .btn-danger-small {
    background: white;
    color: #ef4444;
    border: 2px solid #ef4444;
    border-radius: 8px;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    transition: all 0.2s ease;
    cursor: pointer;
  }

  .btn-danger-small:hover {
    background: #ef4444;
    color: white;
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
  }

  /* Input */
  .input {
    padding: 0.875rem 1rem;
    background: white;
    border: 2px solid rgba(26, 26, 78, 0.1);
    border-radius: 10px;
    color: #1a1a4e;
    transition: all 0.2s ease;
    font-size: 0.9375rem;
  }

  .input:focus {
    outline: none;
    border-color: #4ecdc4;
    box-shadow: 0 0 0 3px rgba(78, 205, 196, 0.1);
  }

  .input::placeholder {
    color: rgba(26, 26, 78, 0.4);
  }

  /* Badge */
  .badge {
    padding: 0.25rem 0.75rem;
    background: #f4d03f;
    border-radius: 999px;
    font-size: 0.75rem;
    color: #1a1a4e;
    font-weight: 700;
  }

  /* Line Clamp */
  .line-clamp-3 {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* SDG Selection Grid */
  .sdg-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: 0.75rem;
    max-height: 300px;
    overflow-y: auto;
    padding: 0.5rem;
    background: rgba(78, 205, 196, 0.03);
    border-radius: 12px;
  }

  .sdg-grid::-webkit-scrollbar {
    width: 6px;
  }

  .sdg-grid::-webkit-scrollbar-track {
    background: rgba(26, 26, 78, 0.05);
    border-radius: 10px;
  }

  .sdg-grid::-webkit-scrollbar-thumb {
    background: rgba(78, 205, 196, 0.3);
    border-radius: 10px;
  }

  .sdg-grid::-webkit-scrollbar-thumb:hover {
    background: rgba(78, 205, 196, 0.5);
  }

  .sdg-selector {
    position: relative;
    aspect-ratio: 1;
    border: 3px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    padding: 0;
    background: white;
    overflow: hidden;
  }

  .sdg-selector:hover:not(:disabled) {
    transform: scale(1.05);
    border-color: #4ecdc4;
    box-shadow: 0 4px 12px rgba(78, 205, 196, 0.2);
  }

  .sdg-selector.selected {
    border-color: #f4d03f;
    box-shadow: 0 4px 16px rgba(244, 208, 63, 0.3);
  }

  .sdg-selector:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .sdg-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .sdg-checkmark {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 24px;
    height: 24px;
    background: #f4d03f;
    color: #1a1a4e;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 900;
    font-size: 14px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  /* SDG Display in Project Cards */
  .sdg-display-container {
    margin-bottom: 1rem;
    padding-top: 0.75rem;
    border-top: 1px solid rgba(26, 26, 78, 0.08);
  }

  .sdg-display-row {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .sdg-badge {
    width: 72px;
    height: 72px;
    border-radius: 8px;
    border: 2px solid rgba(26, 26, 78, 0.1);
    transition: all 0.2s ease;
    cursor: help;
  }

  .sdg-badge:hover {
    transform: scale(1.1);
    border-color: #4ecdc4;
    box-shadow: 0 4px 12px rgba(78, 205, 196, 0.25);
  }

  /* Modal Overlay & Content */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(26, 26, 78, 0.2);
    backdrop-filter: blur(12px);
    z-index: 1001;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .modal-content {
    background: white;
    border-radius: 16px;
    box-shadow: 0 2px 12px rgba(26, 26, 78, 0.06);
    border: 1px solid rgba(26, 26, 78, 0.08);
    max-width: 42rem;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    padding: 2rem;
    position: relative;
  }
</style>
