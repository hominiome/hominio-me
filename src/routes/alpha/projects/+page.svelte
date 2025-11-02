<script lang="ts">
  import { nanoid } from "nanoid";
  import { getContext } from "svelte";
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { authClient } from "$lib/auth.client.js";
  import { getUserProfile, prefetchUserProfiles } from "$lib/userProfileCache";
  import UserAutocomplete from "$lib/UserAutocomplete.svelte";
  import CountryAutocomplete from "$lib/CountryAutocomplete.svelte";
  import { showError } from "$lib/toastStore.js";
  import ConfirmDialog from "$lib/ConfirmDialog.svelte";
  import Modal from "$lib/Modal.svelte";
  import { goto } from "$app/navigation";

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
    country: null as { name: string } | null,
    city: "",
    videoUrl: "",
    sdgs: [] as string[],
  });
  let selectedOwner = $state<{
    id: string;
    name: string | null;
    image: string | null;
  } | null>(null);

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

  // Detect modal params from URL
  const showCreateModal = $derived($page.url.searchParams.get("modal") === "create-project");
  const showEditModal = $derived($page.url.searchParams.get("modal") === "edit-project");
  const editProjectId = $derived($page.url.searchParams.get("projectId") || "");
  
  // Debug URL params
  $effect(() => {
    console.log("📋 URL params:", {
      modal: $page.url.searchParams.get("modal"),
      projectId: $page.url.searchParams.get("projectId"),
      showEditModal,
      editProjectId,
    });
  });
  
  // Edit form state (declare before derived that uses it)
  let editProject = $state<any>(null);
  let editLoading = $state(false);
  let editSaving = $state(false);
  let editFormData = $state({
    title: "",
    description: "",
    country: null as { name: string } | null,
    city: "",
    videoUrl: "",
    videoThumbnail: "",
    sdgs: [] as string[],
  });
  let editSelectedOwner = $state<{
    id: string;
    name: string | null;
    image: string | null;
  } | null>(null);
  
  // Form validation states (after state declarations)
  const canCreateProject = $derived(
    newProject.title.trim() &&
    newProject.description.trim() &&
    newProject.country &&
    newProject.city.trim() &&
    newProject.sdgs.length > 0
  );
  
  const canSaveEditProject = $derived(
    editProject &&
    editFormData.title.trim() &&
    editFormData.description.trim() &&
    editFormData.country &&
    editFormData.city.trim() &&
    editFormData.sdgs.length > 0 &&
    !editSaving
  );
  
  // Submit handlers
  function handleCreateSubmit() {
    const form = document.getElementById("create-project-form") as HTMLFormElement;
    if (form && canCreateProject) {
      form.requestSubmit();
    }
  }
  
  function handleEditSubmit() {
    const form = document.getElementById("edit-project-form") as HTMLFormElement;
    if (form && canSaveEditProject) {
      form.requestSubmit();
    }
  }
  
  // Expose submit functions and state globally for layout to access (reactive)
  $effect(() => {
    if (typeof window !== "undefined") {
      (window as any).__projectModalActions = {
        handleCreateSubmit,
        handleEditSubmit,
        canCreateProject,
        canEditProject: canSaveEditProject,
        editSaving,
        showCreateModal,
        showEditModal,
      };
    }
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
    // Reset edit state
    editProject = null;
    editFormData = {
      title: "",
      description: "",
      country: null,
      city: "",
      videoUrl: "",
      videoThumbnail: "",
      sdgs: [],
    };
    editSelectedOwner = null;
  }
  
  // Load project data when edit modal opens
  $effect(() => {
    console.log("🔍 Edit modal effect:", { showEditModal, editProjectId, zero: !!zero, projectsCount: projects.length });
    
    if (showEditModal && editProjectId && zero) {
      // Reset state when projectId changes
      if (editProject && editProject.id !== editProjectId) {
        console.log("🔄 Project ID changed, resetting");
        editProject = null;
        editLoading = true;
      }
      
      if (!editProject && !editLoading) {
        console.log("📥 Loading project for edit:", editProjectId);
        editLoading = true;
        
        // First try to find in already loaded projects
        const project = projects.find((p) => p.id === editProjectId);
        
        if (project) {
          console.log("✅ Found project in list");
          // Found in list, use it
          editProject = project;
          editFormData = {
            title: project.title || "",
            description: project.description || "",
            country: project.country ? { name: project.country } : null,
            city: project.city || "",
            videoUrl: project.videoUrl || "",
            videoThumbnail: project.videoThumbnail || "",
            sdgs: project.sdgs ? (typeof project.sdgs === "string" ? JSON.parse(project.sdgs || "[]") : project.sdgs) : [],
          };
          if (project.userId) {
            getUserProfile(project.userId).then((profile) => {
              editSelectedOwner = {
                id: profile.id,
                name: profile.name,
                image: profile.image,
              };
            });
          }
          editLoading = false;
        } else {
          console.log("🔍 Project not in list, querying Zero directly");
          // Not in list, query directly from Zero using a listener
          let projectView: any = null;
          let timeoutId: any = null;
          let hasReceivedData = false;
          
          (async () => {
            try {
              // Wait a bit for Zero to be fully ready
              await new Promise(resolve => setTimeout(resolve, 100));
              
              const projectQuery = zero.query.project.where("id", "=", editProjectId);
              projectView = projectQuery.materialize();
              
              // Use listener to get the project data
              projectView.addListener((data: any) => {
                hasReceivedData = true;
                const projectData = Array.from(data || []);
                console.log("📦 Zero query result:", { count: projectData.length, projectId: editProjectId, data: projectData[0]?.id });
                
                if (projectData.length > 0) {
                  const fetchedProject = projectData[0];
                  console.log("✅ Found project via Zero:", fetchedProject.id, fetchedProject.title);
                  
                  // Check if we still need this project (might have changed)
                  if (editProjectId === fetchedProject.id && (!editProject || editProject.id !== fetchedProject.id)) {
                    editProject = fetchedProject;
                    editFormData = {
                      title: fetchedProject.title || "",
                      description: fetchedProject.description || "",
                      country: fetchedProject.country ? { name: fetchedProject.country } : null,
                      city: fetchedProject.city || "",
                      videoUrl: fetchedProject.videoUrl || "",
                      videoThumbnail: fetchedProject.videoThumbnail || "",
                      sdgs: fetchedProject.sdgs ? (typeof fetchedProject.sdgs === "string" ? JSON.parse(fetchedProject.sdgs || "[]") : fetchedProject.sdgs) : [],
                    };
                    if (fetchedProject.userId) {
                      getUserProfile(fetchedProject.userId).then((profile) => {
                        editSelectedOwner = {
                          id: profile.id,
                          name: profile.name,
                          image: profile.image,
                        };
                      });
                    }
          editLoading = false;
                    
                    // Clean up listener after getting data
                    if (timeoutId) clearTimeout(timeoutId);
                    setTimeout(() => {
                      if (projectView) {
                        projectView.destroy();
                      }
                    }, 100);
                  }
                } else if (hasReceivedData && projectData.length === 0) {
                  console.log("❌ No project found in Zero query - project doesn't exist");
                  editLoading = false;
                  if (timeoutId) clearTimeout(timeoutId);
                  setTimeout(() => {
                    if (projectView) {
                      projectView.destroy();
                    }
                  }, 100);
                }
              });
              
              // Set a timeout to stop loading if no data arrives
              timeoutId = setTimeout(() => {
                if (editLoading && !editProject && !hasReceivedData) {
                  console.log("⏱️ Timeout waiting for project data - Zero may not be synced yet");
                  editLoading = false;
                  if (projectView) {
                    projectView.destroy();
                  }
                }
              }, 5000); // Increased timeout to 5 seconds
            } catch (error) {
              console.error("❌ Failed to fetch project for editing:", error);
              editLoading = false;
              if (timeoutId) clearTimeout(timeoutId);
              if (projectView) {
                projectView.destroy();
              }
            }
          })();
        }
      }
    } else if (!showEditModal) {
      // Reset when modal closes
      console.log("🚪 Modal closed, resetting");
      editProject = null;
      editLoading = false;
    }
  });
  
  function toggleEditSDG(sdgId: string) {
    if (editFormData.sdgs.includes(sdgId)) {
      editFormData.sdgs = editFormData.sdgs.filter((id) => id !== sdgId);
    } else {
      if (editFormData.sdgs.length < 3) {
        editFormData.sdgs = [...editFormData.sdgs, sdgId];
      }
    }
  }
  
  async function updateProject() {
    if (!editProject || editSaving || !editFormData.title.trim() || !editFormData.description.trim() || !editFormData.country || !editFormData.city.trim() || editFormData.sdgs.length === 0) {
      return;
    }
    
    if (!isAdmin) {
      showError("Only admins can update projects");
      return;
    }
    
    const newUserId = editSelectedOwner ? editSelectedOwner.id : editProject.userId;
    editSaving = true;
    
    try {
      const response = await fetch("/alpha/api/update-project", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId: editProject.id,
          title: editFormData.title.trim(),
          description: editFormData.description.trim(),
          country: editFormData.country.name,
          city: editFormData.city.trim(),
          videoUrl: editFormData.videoUrl.trim() || "",
          videoThumbnail: editFormData.videoThumbnail.trim() || "",
          sdgs: JSON.stringify(editFormData.sdgs),
          userId: newUserId,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update project");
      }
      
      handleEditModalClose();
    } catch (error) {
      console.error("Failed to update project:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      showError(`Failed to update project: ${message}`);
    } finally {
      editSaving = false;
    }
  }
  
  onMount(() => {
    // Check if URL has create parameter to open form directly (legacy support)
    const shouldCreate = $page.url.searchParams.get("create") === "true" || $page.url.searchParams.get("modal") === "create-project";
    if (shouldCreate && $session.data?.user) {
      showCreateForm = true;
    }

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
      !newProject.country ||
      !newProject.city.trim() ||
      newProject.sdgs.length === 0
    )
      return;

    // Use selected owner if admin selected one, otherwise use current user
    const ownerId =
      isAdmin && selectedOwner ? selectedOwner.id : $session.data.user.id;

    await zero.mutate.project.insert({
      id: nanoid(),
      title: newProject.title,
      description: newProject.description,
      country: newProject.country.name,
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
      country: null,
      city: "",
      videoUrl: "",
      sdgs: [],
    };
    selectedOwner = null;
    showCreateForm = false;
    // Close modal by removing query param
    handleCreateModalClose();
  }

  let showDeleteConfirm = $state(false);
  let projectToDelete = $state<string | null>(null);

  function requestDeleteProject(id: string) {
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

    projectToDelete = id;
    showDeleteConfirm = true;
  }

  async function confirmDeleteProject() {
    if (!projectToDelete) return;

    try {
      // Use API endpoint to delete project (handles admin-only permission properly)
      const response = await fetch("/alpha/api/delete-project", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId: projectToDelete,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete project");
      }

      projectToDelete = null;
      showDeleteConfirm = false;
    } catch (error) {
      console.error("Failed to delete project:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      showError(`Failed to delete project: ${message}`);
    }
  }

  function isMyProject(project: any) {
    return project.userId === $session.data?.user?.id;
  }

  function canEditProject(project: any) {
    // Only admins can edit projects
    return isAdmin;
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
              onclick={() => {
                const url = new URL($page.url);
                url.searchParams.set("modal", "create-project");
                goto(url.pathname + url.search, { replaceState: false });
              }}
              class="btn-primary px-5 py-2 text-sm"
            >
              <span class="text-lg mr-1">+</span>
              New Project
            </button>
          {/if}
        </div>
      </div>

      <!-- Create Form Modal -->
      {#if showCreateModal && $session.data?.user}
        <Modal open={showCreateModal} onClose={handleCreateModalClose}>
          <div class="create-project-content">
            <h2 class="text-3xl font-bold text-navy mb-6">
              Create New Project
            </h2>
            <form
              id="create-project-form"
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
                  class="block text-navy/80 font-medium mb-2">City *</label
                >
                <input
                  id="project-city"
                  type="text"
                  bind:value={newProject.city}
                  placeholder="Berlin"
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

            </form>
          </div>
        </Modal>
      {/if}

      <!-- Edit Project Modal -->
      {#if showEditModal && $session.data?.user && editProjectId}
        <Modal open={showEditModal} onClose={handleEditModalClose}>
          <div class="edit-project-content">
            <h2 class="text-3xl font-bold text-navy mb-6">
              Edit Project
            </h2>
            {#if editLoading}
              <div class="text-center py-8">
                <p class="text-navy/70">Loading project...</p>
              </div>
            {:else if !editProject}
              <div class="text-center py-8">
                <p class="text-navy/70">Project not found</p>
              </div>
            {:else}
              <form
                id="edit-project-form"
                onsubmit={(e) => {
                  e.preventDefault();
                  updateProject();
                }}
                class="space-y-5"
              >
                <!-- Title -->
                <div>
                  <label
                    for="edit-project-title"
                    class="block text-navy/80 font-medium mb-2">Title *</label
                  >
                  <input
                    id="edit-project-title"
                    type="text"
                    bind:value={editFormData.title}
                    placeholder="My Amazing Project"
                    class="input w-full"
                    required
                  />
                </div>

                <!-- Description -->
                <div>
                  <label
                    for="edit-project-description"
                    class="block text-navy/80 font-medium mb-2">Description *</label
                  >
                  <textarea
                    id="edit-project-description"
                    bind:value={editFormData.description}
                    placeholder="Tell us about your project..."
                    rows="4"
                    class="input w-full"
                    required
                  ></textarea>
                </div>

                <!-- Country -->
                <div>
                  <CountryAutocomplete
                    bind:value={editFormData.country}
                    label="Country"
                    placeholder="Select a country..."
                    required
                  />
                </div>

                <!-- City -->
                <div>
                  <label
                    for="edit-project-city"
                    class="block text-navy/80 font-medium mb-2">City *</label
                  >
                  <input
                    id="edit-project-city"
                    type="text"
                    bind:value={editFormData.city}
                    placeholder="Berlin"
                    class="input w-full"
                    required
                  />
                </div>

                <!-- Video URL (Optional) -->
                <div>
                  <label
                    for="edit-project-videoUrl"
                    class="block text-navy/80 font-medium mb-2"
                  >
                    YouTube Video URL (Optional)
                  </label>
                  <input
                    id="edit-project-videoUrl"
                    type="url"
                    bind:value={editFormData.videoUrl}
                    placeholder="https://www.youtube.com/watch?v=..."
                    class="input w-full"
                  />
                  <p class="text-sm text-navy/60 mt-1">
                    Add a YouTube link for your project pitch video
                  </p>
                </div>

                <!-- Video Thumbnail URL (Optional) -->
                <div>
                  <label
                    for="edit-project-videoThumbnail"
                    class="block text-navy/80 font-medium mb-2"
                  >
                    Video Thumbnail Image URL (Optional)
                  </label>
                  <input
                    id="edit-project-videoThumbnail"
                    type="url"
                    bind:value={editFormData.videoThumbnail}
                    placeholder="https://example.com/thumbnail.jpg"
                    class="input w-full"
                  />
                  <p class="text-sm text-navy/60 mt-1">
                    Custom thumbnail image (falls back to Unsplash if not provided)
                  </p>
                </div>

                <!-- Project Owner -->
                {#if isAdmin}
                  <div>
                    <UserAutocomplete
                      bind:value={editSelectedOwner}
                      label="Project Owner"
                      placeholder="Search for a user..."
                    />
                    <p class="text-sm text-navy/60 mt-1">
                      Change the project owner (admin only)
                    </p>
                  </div>
                {/if}

                <!-- SDG Selection -->
                <div>
                  <label
                    for="edit-project-sdgs"
                    class="block text-navy/80 font-medium mb-2"
                  >
                    Sustainable Development Goals (Select 1-3) *
                  </label>
                  <p class="text-sm text-navy/60 mb-3">
                    Selected: {editFormData.sdgs.length}/3
                  </p>
                  <div class="sdg-grid">
                    {#each availableSDGs as sdg}
                      <button
                        type="button"
                        onclick={() => toggleEditSDG(sdg.id)}
                        class="sdg-selector {editFormData.sdgs.includes(sdg.id)
                          ? 'selected'
                          : ''}"
                        disabled={!editFormData.sdgs.includes(sdg.id) &&
                          editFormData.sdgs.length >= 3}
                        title={sdg.name}
                      >
                        <img
                          src="/sdgs/{sdg.id}.svg"
                          alt={sdg.name}
                          class="sdg-image"
                        />
                        {#if editFormData.sdgs.includes(sdg.id)}
                          <div class="sdg-checkmark">✓</div>
                        {/if}
                      </button>
                    {/each}
                  </div>
                </div>

              </form>
            {/if}
          </div>
        </Modal>
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
            {@const thumbnailUrl =
              project.videoThumbnail &&
              typeof project.videoThumbnail === "string" &&
              project.videoThumbnail.trim().length > 0
                ? project.videoThumbnail.trim()
                : `https://picsum.photos/seed/${project.id || "project"}/400/225`}
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
                      e.target.src = `https://picsum.photos/seed/${project.id || "project"}/400/225`;
                    }}
                  />
                </div>

                <!-- Main Content Area -->
                <div class="project-main-content">
                  <!-- Content Section -->
                  <div class="project-content">
                    <!-- Card Header -->
                    <div class="flex justify-between items-start mb-3">
                      <a
                        href="/alpha/projects/{project.id}"
                        class="project-title-link"
                      >
                        <h3 class="text-2xl font-bold text-navy leading-tight">
                          {project.title}
                        </h3>
                      </a>
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
                            {userProfile?.name?.[0] ||
                              project.userId?.[0] ||
                              "?"}
                          </div>
                        {/if}
                        <span class="founder-name"
                          >{userProfile?.name || "Anonymous"}</span
                        >
                      </div>
                    </a>

                    <!-- Location -->
                    <div
                      class="flex items-center gap-2 text-teal text-sm font-medium mb-4"
                    >
                      <svg
                        class="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fill-rule="evenodd"
                          d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                          clip-rule="evenodd"
                        />
                      </svg>
                      {project.city}{project.country
                        ? `, ${project.country}`
                        : ""}
                    </div>

                    <!-- Description -->
                    <p
                      class="text-navy/70 text-sm leading-relaxed mb-4 line-clamp-3 project-description"
                    >
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
                      href="?modal=edit-project&projectId={project.id}"
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
                    {#if isAdmin}
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

    /* Reduce gap between description and SDGs on mobile */
    .project-content .project-description {
      margin-bottom: 0.75rem;
    }

    .project-sdgs-sidebar {
      width: 100%;
      padding: 1rem 1.5rem;
      align-items: flex-start;
      margin-top: -0.25rem; /* Pull SDGs closer to description */
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
    padding: 0.5rem;
    background: rgba(78, 205, 196, 0.03);
    border-radius: 12px;
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

  /* SDG Display in Project Cards - unused styles removed */

  /* Create/Edit Project Content */
  .create-project-content,
  .edit-project-content {
    width: 100%;
    overflow: visible; /* Don't constrain SDG grid */
  }
  
  /* Ensure forms and all containers don't create scroll containers */
  .create-project-content form,
  .edit-project-content form {
    overflow: visible;
    max-height: none;
  }
  
  /* Ensure SDG grid parent containers don't scroll */
  .create-project-content *,
  .edit-project-content * {
    max-height: none;
  }
  
  .create-project-content .sdg-grid,
  .edit-project-content .sdg-grid {
    overflow: visible !important;
    max-height: none !important;
  }

  .project-title-link {
    text-decoration: none;
    color: inherit;
    transition: color 0.2s;
    display: block;
  }

  .project-title-link:hover {
    color: #4ecdc4;
  }

  .project-title-link h3 {
    transition: color 0.2s;
  }
</style>
