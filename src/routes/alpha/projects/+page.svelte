<script>
  import { nanoid } from "nanoid";
  import { getContext } from "svelte";
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { authClient } from "$lib/auth.client.js";
  import { getUserProfile, prefetchUserProfiles } from "$lib/userProfileCache";
  import UserAutocomplete from "$lib/UserAutocomplete.svelte";
  import CountryAutocomplete from "$lib/CountryAutocomplete.svelte";
  import { showError } from "$lib/toastStore.js";
import Modal from "$lib/Modal.svelte";
import { goto } from "$app/navigation";
import TigrisImageUpload from "$lib/components/TigrisImageUpload.svelte";
import { browser } from "$app/environment";
import { projectById, identitiesByUser } from "$lib/synced-queries";
import { Button, Icon } from "$lib/design-system/atoms";
import { PageHeader, PageHeaderActions } from "$lib/design-system/molecules";
import EditProjectContent from "$lib/EditProjectContent.svelte";

  // Get Zero instance from context (initialized in layout)
  const zeroContext = getContext("zero");

  let zero = null;
  let projects = $state([]);
  let loading = $state(true);
  let showCreateForm = $state(false);
  let isAdmin = $state(false);
  let userProfiles = $state(new Map());
  let userIdentities = $state([]);
  let userIdentitiesView = null;
  // Track which user images have failed to load
  let failedImages = $state(new Set());

  // Form state
  let newProject = $state({
    title: "",
    description: "",
    country: null,
    city: "",
    videoUrl: "",
    bannerImage: "",
    profileImageUrl: "",
    sdgs: [],
  });
  let selectedOwner = $state(null);

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

  function toggleSDG(sdgId) {
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

  // Detect modal params from URL
  const showCreateModal = $derived(
    $page.url.searchParams.get("modal") === "create-project"
  );
  const showEditModal = $derived(
    $page.url.searchParams.get("modal") === "edit-project"
  );
  const editProjectId = $derived($page.url.searchParams.get("projectId") || "");

  // Form validation states (after state declarations)
  const canCreateProject = $derived(
    newProject.title.trim() &&
      newProject.description.trim() &&
      newProject.country &&
      newProject.city.trim() &&
      newProject.sdgs.length > 0
  );

  // Submit handlers
  function handleCreateSubmit() {
    const form = document.getElementById("create-project-form");
    if (form && canCreateProject) {
      form.requestSubmit();
    }
  }

  function handleEditSubmit() {
    // The EditProjectContent component handles this internally
    const form = document.getElementById("edit-project-form");
    if (form) {
      form.requestSubmit();
    }
  }

  // Expose submit functions and state globally for layout to access (reactive)
  // Use requestAnimationFrame to debounce updates and avoid forced reflows
  let rafId = null;
  $effect(() => {
    // Access reactive values at effect level to ensure tracking
    const canCreate = canCreateProject;
    const isCreating = creating;
    const showCreate = showCreateModal;
    const showEdit = showEditModal;

    if (typeof window !== "undefined") {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => {
        // Get edit actions from component if available, otherwise provide defaults
        const editActions = window.__projectModalActions;
        window.__projectModalActions = {
          handleCreateSubmit,
          handleEditSubmit,
          canCreateProject: canCreate,
          canEditProject: editActions?.canEditProject ?? true,
          editSaving: editActions?.editSaving ?? false,
          creating: isCreating,
          showCreateModal: showCreate,
          showEditModal: showEdit,
        };
        rafId = null;
      });
    }
    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };
  });

  function handleCreateModalClose() {
    const url = new URL($page.url);
    url.searchParams.delete("modal");
    goto(url.pathname + url.search, { replaceState: true });
  }

  function handleEditModalClose() {
    const url = new URL($page.url);
    url.searchParams.delete("modal");
    url.searchParams.delete("projectId");
    goto(url.pathname + url.search, { replaceState: true });
  }

  onMount(() => {
    // Check if URL has create parameter to open form directly (legacy support)
    const shouldCreate =
      $page.url.searchParams.get("create") === "true" ||
      $page.url.searchParams.get("modal") === "create-project";
    if (shouldCreate && $session.data?.user) {
      showCreateForm = true;
    }

    if (!zeroContext) {
      console.error("Zero context not found");
      loading = false;
      return;
    }

    let projectsView = null;

    // Wait for Zero to be ready
    const checkZero = setInterval(() => {
      if (zeroContext.isReady() && zeroContext.getInstance()) {
        clearInterval(checkZero);
        zero = zeroContext.getInstance();

        // Use synced query (client-side only, SSR doesn't need this)
        if (browser) {
          import("$lib/synced-queries")
            .then(({ allProjects }) => {
              // Query ALL projects using synced query (server-controlled)
              // Use zero.materialize() instead of query.materialize() for synced queries
              const projectsQuery = allProjects();
              projectsView = zero.materialize(projectsQuery);

              projectsView.addListener(async (data) => {
                const newProjects = Array.from(data);
                projects = newProjects;
                loading = false;

                // Fetch user profiles for all projects
                const userIds = [
                  ...new Set(newProjects.map((p) => p.userId).filter(Boolean)),
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
            })
            .catch((error) => {
              console.error("Failed to load synced queries:", error);
              loading = false;
            });
        }

        // Query user identities to check for founder status
        if ($session.data?.user) {
          const userId = $session.data.user.id;
          const identitiesQuery = identitiesByUser(userId);
          userIdentitiesView = zero.materialize(identitiesQuery);

          userIdentitiesView.addListener((data) => {
            userIdentities = Array.from(data || []);
          });
        }
      }
    }, 100);

    return () => {
      clearInterval(checkZero);
      if (projectsView) projectsView.destroy();
      if (userIdentitiesView) userIdentitiesView.destroy();
    };
  });

  // Check if user has founder identity (any cup)
  const hasFounderIdentity = $derived(() => {
    if (!userIdentities || userIdentities.length === 0) return false;
    return userIdentities.some(
      (identity) => identity.identityType === "founder"
    );
  });

  async function createProject() {
    if (!zero || creating) {
    if (!zero) {
      showError("Zero sync is not ready. Please wait...");
      }
      return;
    }

    if (!$session.data?.user) {
      showError(
        "You must be logged in to create projects. Please log in first."
      );
      return;
    }

    // Check if user has founder identity
    if (!hasFounderIdentity() && !isAdmin) {
      showError(
        "Only founders can create projects. Please purchase a founder identity first."
      );
      return;
    }

    if (
      !newProject.title.trim() ||
      !newProject.description.trim() ||
      !newProject.country ||
      !newProject.city.trim() ||
      newProject.sdgs.length === 0
    )
      return;

    creating = true;

    // Use selected owner if admin selected one, otherwise use current user
    const ownerId =
      isAdmin && selectedOwner ? selectedOwner.id : $session.data.user.id;

    // Fire and forget - Zero handles optimistic updates
    // Catch errors to show user-friendly messages
    try {
      await zero.mutate.project
        .create({
          id: nanoid(),
          title: newProject.title,
          description: newProject.description,
          country: newProject.country.name,
          city: newProject.city,
          videoUrl: newProject.videoUrl.trim() || "",
          bannerImage: newProject.bannerImage.trim() || "",
          profileImageUrl: newProject.profileImageUrl.trim() || "",
          userId: ownerId,
          sdgs: JSON.stringify(newProject.sdgs),
          createdAt: new Date().toISOString(),
        })
        .server.catch((error) => {
          // Handle server-side errors
          console.error("[createProject] Server error:", error);
          const errorMessage =
            error?.details || error?.message || "Failed to create project";
          showError(errorMessage);
        });
    } catch (error) {
      // Handle client-side errors
      console.error("[createProject] Client error:", error);
      const errorMessage = error?.message || "Failed to create project";
      showError(errorMessage);
    } finally {
      creating = false;
    }

    // Reset form
    newProject = {
      title: "",
      description: "",
      country: null,
      city: "",
      videoUrl: "",
      bannerImage: "",
      profileImageUrl: "",
      sdgs: [],
    };
    selectedOwner = null;
    showCreateForm = false;
    // Close modal by removing query param
    handleCreateModalClose();
  }

  // Delete modal state - now uses URL params
  const showDeleteModal = $derived(
    $page.url.searchParams.get("modal") === "delete-project"
  );
  const deleteProjectId = $derived(
    $page.url.searchParams.get("projectId") || ""
  );
  const projectToDelete = $derived(
    deleteProjectId ? projects.find((p) => p.id === deleteProjectId) : null
  );

  function requestDeleteProject(id) {
    if (!zero || !$session.data?.user) return;

    // Find the project
    const project = projects.find((p) => p.id === id);
    if (!project) {
      showError("Project not found.");
      return;
    }

    // Only admins can delete projects (users can no longer delete their own)
    if (!isAdmin) {
      showError("Only admins can delete projects.");
      return;
    }

    // Open delete modal via URL
    const url = new URL($page.url);
    url.searchParams.set("modal", "delete-project");
    url.searchParams.set("projectId", id);
    goto(url.pathname + url.search, { replaceState: false });
  }

  function handleDeleteModalClose() {
    const url = new URL($page.url);
    url.searchParams.delete("modal");
    url.searchParams.delete("projectId");
    goto(url.pathname + url.search, { replaceState: true });
  }

  async function confirmDeleteProject() {
    if (!deleteProjectId || !zero) return;

    try {
      // Use Zero custom mutator for project delete (admin-only)
      // Fire and forget - Zero handles optimistic updates
      zero.mutate.project.delete({ id: deleteProjectId });

      handleDeleteModalClose();
    } catch (error) {
      console.error("Failed to delete project:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      showError(`Failed to delete project: ${message}`);
      handleDeleteModalClose(); // Close modal even on error
    }
  }

  // Expose delete action for layout navbar
  $effect(() => {
    if (typeof window !== "undefined") {
      if (showDeleteModal && projectToDelete) {
        window.__deleteModalActions = {
          handleDelete: confirmDeleteProject,
          handleCancel: handleDeleteModalClose,
        };
      } else {
        delete window.__deleteModalActions;
      }
    }
  });

  function isMyProject(project) {
    return project.userId === $session.data?.user?.id;
  }

  function canEditProject(project) {
    // Owners and admins can edit projects
    if (!project || !$session.data?.user) return false;
    return project.userId === $session.data.user.id || isAdmin;
  }
</script>

<div class="@container min-h-screen px-2 sm:px-4 md:p-8">
  {#if $session.isPending || loading}
    <div class="flex items-center justify-center min-h-screen">
      <div
        class="bg-white rounded-2xl border border-brand-navy-100 shadow-md p-8 transition-all duration-300 hover:shadow-lg"
      >
        <p class="text-brand-navy-700">Loading projects...</p>
      </div>
    </div>
  {:else}
    <div>
      <!-- Header -->
      <div
        class="sticky top-0 z-50 py-1 @md:py-2 mb-5 px-2 sm:px-4 lg:px-8 relative"
        style="margin-left: calc(-50vw + 50%); margin-right: calc(-50vw + 50%); width: 100vw;"
      >
        <div
          class="absolute inset-0"
          style="background: linear-gradient(to top, transparent 0%, rgba(250, 249, 246, 0.75) 50%, rgba(250, 249, 246, 1) 100%); backdrop-filter: blur(28px) saturate(200%); -webkit-backdrop-filter: blur(28px) saturate(200%); mask-image: linear-gradient(to top, transparent 0%, rgba(0,0,0,0.75) 50%, black 100%); -webkit-mask-image: linear-gradient(to top, transparent 0%, rgba(0,0,0,0.75) 50%, black 100%); pointer-events: none; border-bottom: 1px solid rgba(255, 255, 255, 0.2); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.2);"
        ></div>
        <div
          class="flex flex-col items-center max-w-md mx-auto pb-4 gap-3 relative z-10"
        >
          <PageHeader
            title="Projects"
            subtitle="Explore amazing projects from around the world"
            size="sm"
          />
          {#if $session.data?.user && (hasFounderIdentity() || isAdmin)}
            <PageHeaderActions>
              {#snippet children()}
                <Button
                  variant="primary"
                  icon="mdi:plus"
                  iconPosition="left"
                  onclick={() => {
                    const url = new URL($page.url);
                    url.searchParams.set("modal", "create-project");
                    goto(url.pathname + url.search, { replaceState: false });
                  }}
                >
                  New Project
                </Button>
              {/snippet}
            </PageHeaderActions>
          {/if}
        </div>
      </div>

      <!-- Create Form Modal -->
      {#if showCreateModal && $session.data?.user}
        <Modal open={showCreateModal} onClose={handleCreateModalClose}>
          <div class="w-full overflow-visible">
            <h2 class="text-3xl font-bold text-brand-navy-500 mb-6">
              Create New Project
            </h2>
            <form
              id="create-project-form"
              onsubmit={(e) => {
                e.preventDefault();
                createProject();
              }}
              class="space-y-5 overflow-visible max-h-none"
            >
              <div>
                <label
                  for="project-title"
                  class="block text-brand-navy-500/80 font-medium mb-2"
                  >Title</label
                >
                <input
                  id="project-title"
                  type="text"
                  bind:value={newProject.title}
                  placeholder="My Amazing Project"
                  class="w-full px-4 py-3.5 bg-white border-2 border-brand-navy-100 rounded-[10px] text-brand-navy-500 transition-all duration-200 text-[0.9375rem] focus:outline-none focus:border-brand-teal-500 focus:shadow-[0_0_0_3px_rgba(78,205,196,0.1)] placeholder:text-brand-navy-500/40"
                  required
                />
              </div>
              <div>
                <label
                  for="project-description"
                  class="block text-brand-navy-500/80 font-medium mb-2"
                  >Description</label
                >
                <textarea
                  id="project-description"
                  bind:value={newProject.description}
                  placeholder="Tell us about your project..."
                  rows="4"
                  class="w-full px-4 py-3.5 bg-white border-2 border-brand-navy-100 rounded-[10px] text-brand-navy-500 transition-all duration-200 text-[0.9375rem] focus:outline-none focus:border-brand-teal-500 focus:shadow-[0_0_0_3px_rgba(78,205,196,0.1)] placeholder:text-brand-navy-500/40"
                  required
                ></textarea>
              </div>
              <div>
                <CountryAutocomplete
                  bind:value={newProject.country}
                  label="Country"
                  placeholder="Select a country..."
                  required
                />
              </div>
              <div>
                <label
                  for="project-city"
                  class="block text-brand-navy-500/80 font-medium mb-2"
                  >City *</label
                >
                <input
                  id="project-city"
                  type="text"
                  bind:value={newProject.city}
                  placeholder="Berlin"
                  class="w-full px-4 py-3.5 bg-white border-2 border-brand-navy-100 rounded-[10px] text-brand-navy-500 transition-all duration-200 text-[0.9375rem] focus:outline-none focus:border-brand-teal-500 focus:shadow-[0_0_0_3px_rgba(78,205,196,0.1)] placeholder:text-brand-navy-500/40"
                  required
                />
              </div>

              <!-- Profile Image (Optional) -->
              <div>
                <div class="block text-brand-navy-500/80 font-medium mb-2">
                  Profile Image (Optional)
                </div>
                <TigrisImageUpload
                  uploadButtonLabel="Upload Profile Image"
                  showPreview={false}
                  existingImageUrl={newProject.profileImageUrl || null}
                  onUploadSuccess={(image) => {
                    newProject.profileImageUrl = image.original.url;
                  }}
                  onUploadError={(error) => {
                    showError(`Failed to upload profile image: ${error}`);
                  }}
                  onChange={() => {
                    // Allow changing the image
                  }}
                  onClear={() => {
                    newProject.profileImageUrl = "";
                  }}
                />
                <p class="text-xs text-brand-navy-500/50 mt-1">
                  Falls back to project owner's profile image if not set
                </p>
              </div>

              <!-- Video URL (Optional) -->
              <div>
                <label
                  for="project-videoUrl"
                  class="block text-brand-navy-500/80 font-medium mb-2"
                >
                  YouTube Video URL (Optional)
                </label>
                <input
                  id="project-videoUrl"
                  type="url"
                  bind:value={newProject.videoUrl}
                  placeholder="https://www.youtube.com/watch?v=..."
                  class="w-full px-4 py-3.5 bg-white border-2 border-brand-navy-100 rounded-[10px] text-brand-navy-500 transition-all duration-200 text-[0.9375rem] focus:outline-none focus:border-brand-teal-500 focus:shadow-[0_0_0_3px_rgba(78,205,196,0.1)] placeholder:text-brand-navy-500/40"
                />
                <p class="text-sm text-brand-navy-500/60 mt-1">
                  Add a YouTube link for your project pitch video
                </p>
              </div>

              <!-- Banner Image (Optional) -->
              <div>
                <div class="block text-brand-navy-500/80 font-medium mb-2">
                  Banner Image (Optional)
                </div>
                <TigrisImageUpload
                  uploadButtonLabel="Upload Banner"
                  showPreview={false}
                  existingImageUrl={newProject.bannerImage || null}
                  onUploadSuccess={(image) => {
                    newProject.bannerImage = image.original.url;
                  }}
                  onUploadError={(error) => {
                    showError(`Failed to upload banner: ${error}`);
                  }}
                  onChange={() => {
                    // Allow changing the banner
                  }}
                  onClear={() => {
                    newProject.bannerImage = "";
                  }}
                />
                <p class="text-sm text-brand-navy-500/60 mt-1">
                  Custom banner image (falls back to Unsplash if not provided)
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
                  <p class="text-sm text-brand-navy-500/60 mt-1">
                    Select project owner (optional, defaults to you)
                  </p>
                </div>
              {/if}

              <!-- SDG Selection -->
              <div>
                <label
                  for="project-sdgs"
                  class="block text-brand-navy-500/80 font-medium mb-2"
                >
                  Sustainable Development Goals (Select 1-3) *
                </label>
                <p class="text-sm text-brand-navy-500/60 mb-3">
                  Selected: {newProject.sdgs.length}/3
                </p>
                <div
                  class="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-3 p-2 bg-brand-teal-500/3 rounded-xl overflow-visible max-h-none"
                >
                  {#each availableSDGs as sdg}
                    <button
                      type="button"
                      onclick={() => toggleSDG(sdg.id)}
                      class="relative aspect-square border-[3px] border-transparent rounded-lg cursor-pointer transition-all duration-200 p-0 bg-white overflow-hidden {newProject.sdgs.includes(
                        sdg.id
                      )
                        ? 'border-brand-yellow-500 shadow-[0_4px_16px_rgba(244,208,63,0.3)]'
                        : 'hover:scale-105 hover:border-brand-teal-500 hover:shadow-[0_4px_12px_rgba(78,205,196,0.2)]'} {!newProject.sdgs.includes(
                        sdg.id
                      ) && newProject.sdgs.length >= 3
                        ? 'opacity-40 cursor-not-allowed'
                        : ''}"
                      disabled={!newProject.sdgs.includes(sdg.id) &&
                        newProject.sdgs.length >= 3}
                      title={sdg.name}
                    >
                      <img
                        src="/sdgs/{sdg.id}.svg"
                        alt={sdg.name}
                        class="w-full h-full object-cover block"
                      />
                      {#if newProject.sdgs.includes(sdg.id)}
                        <div
                          class="absolute top-1 right-1 w-6 h-6 bg-brand-yellow-500 text-brand-navy-500 rounded-full flex items-center justify-center font-black text-sm shadow-[0_2px_8px_rgba(0,0,0,0.2)]"
                        >
                          ✓
                        </div>
                      {/if}
                    </button>
                  {/each}
                </div>
              </div>
            </form>
          </div>
        </Modal>
      {/if}

      <!-- Edit Project Modal -->
      {#if showEditModal && $session.data?.user && editProjectId}
        <Modal open={showEditModal} onClose={handleEditModalClose}>
          <EditProjectContent projectId={editProjectId} onSuccess={handleEditModalClose} />
        </Modal>
      {/if}

      <!-- Grid View Layout -->
      {#if projects.length === 0}
        <div
          class="bg-white rounded-2xl border border-brand-navy-100 shadow-md p-16 transition-all duration-300 hover:shadow-lg"
        >
          <div class="text-center">
            <p class="text-brand-navy-700 text-lg">
              No projects yet. Create the first one!
            </p>
          </div>
        </div>
      {:else}
        <div class="flex flex-col gap-6 w-full">
          {#each projects as project (project.id)}
            {@const userProfile = userProfiles.get(project.userId)}
            {@const thumbnailUrl =
              project.bannerImage &&
              typeof project.bannerImage === "string" &&
              project.bannerImage.trim().length > 0
                ? project.bannerImage.trim()
                : `https://picsum.photos/seed/${project.id || "project"}/400/225`}
            <div
              class="bg-white rounded-2xl border-2 border-brand-navy-500/6 p-0 transition-all duration-300 flex flex-col overflow-hidden w-full min-h-[240px] hover:border-brand-teal-500/40 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(78,205,196,0.15)] @3xs:min-h-auto"
            >
              <!-- Top Section: Thumbnail and Content Side by Side -->
              <div
                class="flex flex-col @md:flex-row flex-1 @3xs:min-h-auto min-h-[240px]"
              >
                <!-- Thumbnail on Left -->
                <div
                  class="flex-shrink-0 w-full @md:w-[280px] @md:min-w-[280px] overflow-hidden bg-brand-navy-500/5 relative flex items-stretch @3xs:h-[200px] @md:h-auto"
                >
                  <img
                    src={thumbnailUrl}
                    alt={project.title}
                    class="w-full h-full @md:min-h-[240px] object-cover block @3xs:min-h-[200px]"
                    onerror={(e) => {
                      e.target.src = `https://picsum.photos/seed/${project.id || "project"}/400/225`;
                    }}
                  />
                </div>

                <!-- Main Content Area -->
                <div
                  class="flex flex-col @md:flex-row flex-1 @3xs:min-h-auto min-h-[240px]"
                >
                  <!-- Content Section -->
                  <div
                    class="flex-1 p-6 @3xs:p-6 flex flex-col pr-16 @md:pr-20 relative"
                  >
                    <!-- Top Row: Profile Icon, Title, Yours Badge, Location -->
                    <div class="flex items-start gap-3 mb-4">
                      <!-- Founder Avatar (Left in Front) -->
                      <a
                        href="/alpha/user/{project.userId}"
                        class="no-underline inline-block transition-all duration-200 hover:scale-105 hover:[&_.founder-avatar]:border-brand-yellow-500 hover:[&_.founder-avatar-placeholder]:border-brand-yellow-500 shrink-0"
                      >
                        {#if userProfile?.image && !failedImages.has(project.userId)}
                          <img
                            src={userProfile.image}
                            alt={userProfile.name || "User"}
                            class="founder-avatar w-[60px] h-[60px] rounded-full border-2 border-brand-teal-500 object-cover transition-colors duration-200"
                            onerror={() => {
                              failedImages = new Set(failedImages).add(
                                project.userId
                              );
                            }}
                          />
                        {:else}
                          <div
                            class="founder-avatar-placeholder w-[60px] h-[60px] rounded-full border-2 border-brand-teal-500 bg-gradient-to-br from-brand-teal-500 to-brand-yellow-500 flex items-center justify-center text-white font-bold text-xl uppercase transition-colors duration-200 leading-none"
                          >
                            {userProfile?.name?.[0] ||
                              project.userId?.[0] ||
                              "?"}
                          </div>
                        {/if}
                      </a>
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-3 mb-2">
                          <a
                            href="/alpha/projects/{project.id}"
                            class="no-underline text-inherit transition-colors duration-200 hover:text-brand-teal-500"
                          >
                            <h3
                              class="text-2xl font-bold text-brand-navy-500 leading-tight transition-colors duration-200"
                            >
                              {project.title}
                            </h3>
                          </a>
                          {#if isMyProject(project)}
                            <span
                              class="px-3 py-1 bg-brand-yellow-500 rounded-full text-xs text-brand-yellow-900 font-bold shrink-0"
                              >Yours</span
                            >
                          {/if}
                        </div>
                        <!-- Location - Right Below Title -->
                        <div
                          class="flex items-center gap-2 text-brand-teal-500 text-sm font-medium"
                        >
                          <svg
                            class="w-4 h-4 shrink-0"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fill-rule="evenodd"
                              d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                              clip-rule="evenodd"
                            />
                          </svg>
                          <span
                            >{project.city}{project.country
                              ? `, ${project.country}`
                              : ""}</span
                          >
                        </div>
                      </div>
                    </div>

                    <!-- Description -->
                    <p
                      class="text-brand-navy-700/70 text-sm leading-relaxed mb-4 @3xs:mb-3 line-clamp-3"
                    >
                      {project.description}
                    </p>

                    <!-- SDGs - Below Description -->
                    {#if project.sdgs}
                      {@const sdgArray =
                        typeof project.sdgs === "string"
                          ? JSON.parse(project.sdgs || "[]")
                          : project.sdgs}
                      {#if sdgArray.length > 0}
                        <div class="flex flex-row gap-2 items-center mt-auto">
                          {#each sdgArray as sdgId}
                            <img
                              src="/sdgs/{sdgId}.svg"
                              alt={sdgId}
                              class="w-[48px] h-[48px] min-w-[48px] min-h-[48px] aspect-square rounded-lg object-cover block"
                              title={availableSDGs.find((s) => s.id === sdgId)
                                ?.name || sdgId}
                            />
                          {/each}
                        </div>
                      {/if}
                    {/if}

                  </div>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  <!-- Delete Confirmation Modal -->
  {#if showDeleteModal && projectToDelete}
    <Modal
      open={showDeleteModal}
      onClose={handleDeleteModalClose}
      variant="danger"
    >
      <div class="w-full">
        <!-- Project Info Header -->
        <div class="mb-6 pb-6 border-b border-alert-100/20">
          <h2 class="text-3xl font-bold text-alert-100 mb-2">Delete Project</h2>
          <h3 class="text-xl font-semibold text-alert-100 mb-2">
            {projectToDelete.title}
          </h3>
          {#if projectToDelete.description}
            <p class="text-alert-100/80 text-sm leading-relaxed line-clamp-3">
              {projectToDelete.description}
            </p>
          {/if}
        </div>
        <p class="text-alert-100/90 mb-4 text-base leading-relaxed">
          Are you sure you want to delete this project? This action cannot be
          undone.
        </p>
      </div>
    </Modal>
  {/if}
</div>
