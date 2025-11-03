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
  import ConfirmDialog from "$lib/ConfirmDialog.svelte";
  import Modal from "$lib/Modal.svelte";
  import { goto } from "$app/navigation";
  import TigrisImageUpload from "$lib/components/TigrisImageUpload.svelte";
  import { browser } from "$app/environment";
  import { projectById, identitiesByUser } from "$lib/synced-queries";
  import { Button, Icon } from "$lib/design-system/atoms";

  // Get Zero instance from context (initialized in layout)
  const zeroContext = getContext("zero");

  let zero = null;
  let projects = $state([]);
  let loading = $state(true);
  let showCreateForm = $state(false);
  let isAdmin = $state(false);
  let userProfiles = $state(
    new Map()
  );
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
  const showCreateModal = $derived($page.url.searchParams.get("modal") === "create-project");
  const showEditModal = $derived($page.url.searchParams.get("modal") === "edit-project");
  const editProjectId = $derived($page.url.searchParams.get("projectId") || "");
  
  // Edit form state (declare before derived that uses it)
  let editProject = $state(null);
  let editLoading = $state(false);
  let editSaving = $state(false);
  let editFormData = $state({
    title: "",
    description: "",
    country: null,
    city: "",
    videoUrl: "",
    bannerImage: "",
    profileImageUrl: "",
    sdgs: [],
  });
  let editSelectedOwner = $state(null);
  
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
    const form = document.getElementById("create-project-form");
    if (form && canCreateProject) {
      form.requestSubmit();
    }
  }
  
  function handleEditSubmit() {
    const form = document.getElementById("edit-project-form");
    if (form && canSaveEditProject) {
      form.requestSubmit();
    }
  }
  
  // Expose submit functions and state globally for layout to access (reactive)
  $effect(() => {
    if (typeof window !== "undefined") {
      window.__projectModalActions = {
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
      bannerImage: "",
      sdgs: [],
    };
    editSelectedOwner = null;
  }
  
  // Load project data when edit modal opens
  $effect(() => {
    if (showEditModal && editProjectId && zero) {
      // Reset state when projectId changes
      if (editProject && editProject.id !== editProjectId) {
        editProject = null;
        editLoading = true;
      }
      
      if (!editProject && !editLoading) {
        editLoading = true;
        
        // First try to find in already loaded projects
        const project = projects.find((p) => p.id === editProjectId);
        
        if (project) {
          // Found in list, use it
          editProject = project;
          editFormData = {
            title: project.title || "",
            description: project.description || "",
            country: project.country ? { name: project.country } : null,
            city: project.city || "",
            videoUrl: project.videoUrl || "",
            bannerImage: project.bannerImage || "",
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
          // Not in list, query directly from Zero using a listener
          let projectView = null;
          let timeoutId = null;
          let hasReceivedData = false;
          
          (async () => {
            try {
              // Wait a bit for Zero to be fully ready
              await new Promise(resolve => setTimeout(resolve, 100));
              
              const projectQuery = projectById(editProjectId);
              projectView = zero.materialize(projectQuery);
              
              // Use listener to get the project data
              projectView.addListener((data) => {
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
                      bannerImage: fetchedProject.bannerImage || "",
                      profileImageUrl: fetchedProject.profileImageUrl || "",
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
      editProject = null;
      editLoading = false;
    }
  });
  
  function toggleEditSDG(sdgId) {
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
      // Use Zero custom mutator for project update
      // Fire and forget - Zero handles optimistic updates
      zero.mutate.project.update({
        id: editProject.id,
        title: editFormData.title.trim(),
        description: editFormData.description.trim(),
        country: editFormData.country?.name || editFormData.country || "",
        city: editFormData.city.trim(),
        videoUrl: (editFormData.videoUrl || "").trim(),
        bannerImage: (editFormData.bannerImage || "").trim(),
        profileImageUrl: (editFormData.profileImageUrl || "").trim(),
        sdgs: JSON.stringify(editFormData.sdgs),
        userId: newUserId,
      });
      
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

    let projectsView = null;

    // Wait for Zero to be ready
    const checkZero = setInterval(() => {
      if (zeroContext.isReady() && zeroContext.getInstance()) {
        clearInterval(checkZero);
        zero = zeroContext.getInstance();

        // Use synced query (client-side only, SSR doesn't need this)
        if (browser) {
          import("$lib/synced-queries").then(({ allProjects }) => {
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
          }).catch((error) => {
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
    return userIdentities.some((identity) => identity.identityType === "founder");
  });

  async function createProject() {
    if (!zero) {
      showError("Zero sync is not ready. Please wait...");
      return;
    }
    
    if (!$session.data?.user) {
      showError("You must be logged in to create projects. Please log in first.");
      return;
    }
    
    // Check if user has founder identity
    if (!hasFounderIdentity() && !isAdmin) {
      showError("Only founders can create projects. Please purchase a founder identity first.");
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

    // Use selected owner if admin selected one, otherwise use current user
    const ownerId =
      isAdmin && selectedOwner ? selectedOwner.id : $session.data.user.id;

    // Fire and forget - Zero handles optimistic updates
    // Catch errors to show user-friendly messages
    try {
      await zero.mutate.project.create({
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
      }).server.catch((error) => {
        // Handle server-side errors
        console.error('[createProject] Server error:', error);
        const errorMessage = error?.details || error?.message || 'Failed to create project';
        showError(errorMessage);
      });
    } catch (error) {
      // Handle client-side errors
      console.error('[createProject] Client error:', error);
      const errorMessage = error?.message || 'Failed to create project';
      showError(errorMessage);
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

  let showDeleteConfirm = $state(false);
  let projectToDelete = $state(null);

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

    projectToDelete = id;
    showDeleteConfirm = true;
  }

  async function confirmDeleteProject() {
    if (!projectToDelete || !zero) return;

    try {
      // Use Zero custom mutator for project delete (admin-only)
      // Fire and forget - Zero handles optimistic updates
      zero.mutate.project.delete({ id: projectToDelete });

      projectToDelete = null;
      showDeleteConfirm = false;
    } catch (error) {
      console.error("Failed to delete project:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      showError(`Failed to delete project: ${message}`);
    }
  }

  function isMyProject(project) {
    return project.userId === $session.data?.user?.id;
  }

  function canEditProject(project) {
    // Only admins can edit projects
    return isAdmin;
  }
</script>

<div class="@container min-h-screen p-8">
  {#if $session.isPending || loading}
    <div class="flex items-center justify-center min-h-screen">
      <div class="bg-white rounded-2xl border border-brand-navy-100 shadow-md p-8 transition-all duration-300 hover:shadow-lg">
        <p class="text-brand-navy-700">Loading projects...</p>
      </div>
    </div>
  {:else}
    <div>
      <!-- Header -->
      <div class="sticky top-0 z-50 bg-brand-cream-50/95 backdrop-blur-sm py-6 mb-6 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 border-b border-brand-navy-500/10">
        <div class="flex flex-col @md:flex-row justify-between items-start @md:items-center gap-4">
          <div>
            <h1 class="text-4xl font-bold text-brand-navy-500 mb-1">Projects</h1>
            <p class="text-brand-navy-700/80 text-sm">
              Explore amazing projects from around the world
            </p>
          </div>
          {#if $session.data?.user && (hasFounderIdentity() || isAdmin)}
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
                  class="block text-brand-navy-500/80 font-medium mb-2">Title</label
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
                  class="block text-brand-navy-500/80 font-medium mb-2">Description</label
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
                  class="block text-brand-navy-500/80 font-medium mb-2">City *</label
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
                <div class="block text-brand-navy-500/80 font-medium mb-2">Profile Image (Optional)</div>
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
                <div class="block text-brand-navy-500/80 font-medium mb-2">Banner Image (Optional)</div>
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
                <div class="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-3 p-2 bg-brand-teal-500/3 rounded-xl overflow-visible max-h-none">
                  {#each availableSDGs as sdg}
                    <button
                      type="button"
                      onclick={() => toggleSDG(sdg.id)}
                      class="relative aspect-square border-[3px] border-transparent rounded-lg cursor-pointer transition-all duration-200 p-0 bg-white overflow-hidden {newProject.sdgs.includes(sdg.id)
                        ? 'border-brand-yellow-500 shadow-[0_4px_16px_rgba(244,208,63,0.3)]'
                        : 'hover:scale-105 hover:border-brand-teal-500 hover:shadow-[0_4px_12px_rgba(78,205,196,0.2)]'} {!newProject.sdgs.includes(sdg.id) && newProject.sdgs.length >= 3 ? 'opacity-40 cursor-not-allowed' : ''}"
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
                        <div class="absolute top-1 right-1 w-6 h-6 bg-brand-yellow-500 text-brand-navy-500 rounded-full flex items-center justify-center font-black text-sm shadow-[0_2px_8px_rgba(0,0,0,0.2)]">✓</div>
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
          <div class="w-full overflow-visible">
            <h2 class="text-3xl font-bold text-brand-navy-500 mb-6">
              Edit Project
            </h2>
            {#if editLoading}
              <div class="text-center py-8">
                <p class="text-brand-navy-500/70">Loading project...</p>
              </div>
            {:else if !editProject}
              <div class="text-center py-8">
                <p class="text-brand-navy-500/70">Project not found</p>
              </div>
            {:else}
              <form
                id="edit-project-form"
                onsubmit={(e) => {
                  e.preventDefault();
                  updateProject();
                }}
                class="space-y-5 overflow-visible max-h-none"
              >
                <!-- Title -->
                <div>
                  <label
                    for="edit-project-title"
                    class="block text-brand-navy-500/80 font-medium mb-2">Title *</label
                  >
                  <input
                    id="edit-project-title"
                    type="text"
                    bind:value={editFormData.title}
                    placeholder="My Amazing Project"
                    class="w-full px-4 py-3.5 bg-white border-2 border-brand-navy-100 rounded-[10px] text-brand-navy-500 transition-all duration-200 text-[0.9375rem] focus:outline-none focus:border-brand-teal-500 focus:shadow-[0_0_0_3px_rgba(78,205,196,0.1)] placeholder:text-brand-navy-500/40"
                    required
                  />
                </div>

                <!-- Description -->
                <div>
                  <label
                    for="edit-project-description"
                    class="block text-brand-navy-500/80 font-medium mb-2">Description *</label
                  >
                  <textarea
                    id="edit-project-description"
                    bind:value={editFormData.description}
                    placeholder="Tell us about your project..."
                    rows="4"
                    class="w-full px-4 py-3.5 bg-white border-2 border-brand-navy-100 rounded-[10px] text-brand-navy-500 transition-all duration-200 text-[0.9375rem] focus:outline-none focus:border-brand-teal-500 focus:shadow-[0_0_0_3px_rgba(78,205,196,0.1)] placeholder:text-brand-navy-500/40"
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
                    class="block text-brand-navy-500/80 font-medium mb-2">City *</label
                  >
                  <input
                    id="edit-project-city"
                    type="text"
                    bind:value={editFormData.city}
                    placeholder="Berlin"
                    class="w-full px-4 py-3.5 bg-white border-2 border-brand-navy-100 rounded-[10px] text-brand-navy-500 transition-all duration-200 text-[0.9375rem] focus:outline-none focus:border-brand-teal-500 focus:shadow-[0_0_0_3px_rgba(78,205,196,0.1)] placeholder:text-brand-navy-500/40"
                    required
                  />
                </div>

                <!-- Profile Image (Optional) -->
                <div>
                  <div class="block text-brand-navy-500/80 font-medium mb-2">Profile Image (Optional)</div>
                  <TigrisImageUpload
                    uploadButtonLabel="Upload Profile Image"
                    showPreview={false}
                    existingImageUrl={editFormData.profileImageUrl || null}
                    onUploadSuccess={(image) => {
                      editFormData.profileImageUrl = image.original.url;
                    }}
                    onUploadError={(error) => {
                      showError(`Failed to upload profile image: ${error}`);
                    }}
                    onChange={() => {
                      // Allow changing the image
                    }}
                    onClear={() => {
                      editFormData.profileImageUrl = "";
                    }}
                  />
                  <p class="text-xs text-brand-navy-500/50 mt-1">
                    Falls back to project owner's profile image if not set
                  </p>
                </div>

                <!-- Video URL (Optional) -->
                <div>
                  <label
                    for="edit-project-videoUrl"
                    class="block text-brand-navy-500/80 font-medium mb-2"
                  >
                    YouTube Video URL (Optional)
                  </label>
                  <input
                    id="edit-project-videoUrl"
                    type="url"
                    bind:value={editFormData.videoUrl}
                    placeholder="https://www.youtube.com/watch?v=..."
                    class="w-full px-4 py-3.5 bg-white border-2 border-brand-navy-100 rounded-[10px] text-brand-navy-500 transition-all duration-200 text-[0.9375rem] focus:outline-none focus:border-brand-teal-500 focus:shadow-[0_0_0_3px_rgba(78,205,196,0.1)] placeholder:text-brand-navy-500/40"
                  />
                  <p class="text-sm text-brand-navy-500/60 mt-1">
                    Add a YouTube link for your project pitch video
                  </p>
                </div>

                <!-- Banner Image (Optional) -->
                <div>
                  <div class="block text-brand-navy-500/80 font-medium mb-2">Banner Image (Optional)</div>
                  <TigrisImageUpload
                    uploadButtonLabel="Upload Banner"
                    showPreview={false}
                    existingImageUrl={editFormData.bannerImage || null}
                    onUploadSuccess={(image) => {
                      editFormData.bannerImage = image.original.url;
                    }}
                    onUploadError={(error) => {
                      showError(`Failed to upload banner: ${error}`);
                    }}
                    onChange={() => {
                      // Allow changing the banner
                    }}
                    onClear={() => {
                      editFormData.bannerImage = "";
                    }}
                  />
                  <p class="text-sm text-brand-navy-500/60 mt-1">
                    Custom banner image (falls back to Unsplash if not provided)
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
                    <p class="text-sm text-brand-navy-500/60 mt-1">
                      Change the project owner (admin only)
                    </p>
                  </div>
                {/if}

                <!-- SDG Selection -->
                <div>
                  <label
                    for="edit-project-sdgs"
                    class="block text-brand-navy-500/80 font-medium mb-2"
                  >
                    Sustainable Development Goals (Select 1-3) *
                  </label>
                  <p class="text-sm text-brand-navy-500/60 mb-3">
                    Selected: {editFormData.sdgs.length}/3
                  </p>
                  <div class="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-3 p-2 bg-brand-teal-500/3 rounded-xl overflow-visible max-h-none">
                    {#each availableSDGs as sdg}
                      <button
                        type="button"
                        onclick={() => toggleEditSDG(sdg.id)}
                        class="relative aspect-square border-[3px] border-transparent rounded-lg cursor-pointer transition-all duration-200 p-0 bg-white overflow-hidden {editFormData.sdgs.includes(sdg.id)
                          ? 'border-brand-yellow-500 shadow-[0_4px_16px_rgba(244,208,63,0.3)]'
                          : 'hover:scale-105 hover:border-brand-teal-500 hover:shadow-[0_4px_12px_rgba(78,205,196,0.2)]'} {!editFormData.sdgs.includes(sdg.id) && editFormData.sdgs.length >= 3 ? 'opacity-40 cursor-not-allowed' : ''}"
                        disabled={!editFormData.sdgs.includes(sdg.id) &&
                          editFormData.sdgs.length >= 3}
                        title={sdg.name}
                      >
                        <img
                          src="/sdgs/{sdg.id}.svg"
                          alt={sdg.name}
                          class="w-full h-full object-cover block"
                        />
                        {#if editFormData.sdgs.includes(sdg.id)}
                          <div class="absolute top-1 right-1 w-6 h-6 bg-brand-yellow-500 text-brand-navy-500 rounded-full flex items-center justify-center font-black text-sm shadow-[0_2px_8px_rgba(0,0,0,0.2)]">✓</div>
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
        <div class="bg-white rounded-2xl border border-brand-navy-100 shadow-md p-16 transition-all duration-300 hover:shadow-lg">
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
            <div class="bg-white rounded-2xl border-2 border-brand-navy-500/6 p-0 transition-all duration-300 flex flex-col overflow-hidden w-full min-h-[240px] hover:border-brand-teal-500/40 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(78,205,196,0.15)] @3xs:min-h-auto">
              <!-- Top Section: Thumbnail and Content Side by Side -->
              <div class="flex flex-col @md:flex-row flex-1 @3xs:min-h-auto min-h-[240px]">
                <!-- Thumbnail on Left -->
                <div class="flex-shrink-0 w-full @md:w-[280px] @md:min-w-[280px] overflow-hidden bg-brand-navy-500/5 relative flex items-stretch @3xs:h-[200px] @md:h-auto">
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
                <div class="flex flex-col @md:flex-row flex-1 @3xs:min-h-auto min-h-[240px]">
                  <!-- Content Section -->
                  <div class="flex-1 p-6 @3xs:p-6 flex flex-col">
                    <!-- Card Header -->
                    <div class="flex justify-between items-start mb-3">
                      <a
                        href="/alpha/projects/{project.id}"
                        class="no-underline text-inherit transition-colors duration-200 block hover:text-brand-teal-500"
                      >
                        <h3 class="text-2xl font-bold text-brand-navy-500 leading-tight transition-colors duration-200">
                          {project.title}
                        </h3>
                      </a>
                      {#if isMyProject(project)}
                        <span class="px-3 py-1 bg-brand-yellow-500 rounded-full text-xs text-brand-navy-500 font-bold">Yours</span>
                      {/if}
                    </div>

                    <!-- Founder Info -->
                    <a href="/alpha/user/{project.userId}" class="no-underline inline-block transition-all duration-200 hover:translate-x-1 hover:[&_.founder-name]:text-brand-teal-500 hover:[&_.founder-avatar]:border-brand-yellow-500 hover:[&_.founder-avatar-placeholder]:border-brand-yellow-500">
                      <div class="flex items-center gap-2.5 mb-3">
                        {#if userProfile?.image && !failedImages.has(project.userId)}
                          <img
                            src={userProfile.image}
                            alt={userProfile.name || "User"}
                            class="w-10 h-10 rounded-full border-2 border-brand-teal-500 object-cover transition-colors duration-200"
                            onerror={() => {
                              failedImages = new Set(failedImages).add(
                                project.userId
                              );
                            }}
                          />
                        {:else}
                          <div class="w-10 h-10 rounded-full border-2 border-brand-teal-500 bg-gradient-to-br from-brand-teal-500 to-brand-yellow-500 flex items-center justify-center text-white font-bold text-lg uppercase transition-colors duration-200 leading-none">
                            {userProfile?.name?.[0] ||
                              project.userId?.[0] ||
                              "?"}
                          </div>
                        {/if}
                        <span class="text-brand-navy-700 font-semibold text-sm transition-colors duration-200 leading-tight"
                          >{userProfile?.name || "Anonymous"}</span
                        >
                      </div>
                    </a>

                    <!-- Location -->
                    <div
                      class="flex items-center gap-2 text-brand-teal-500 text-sm font-medium mb-4"
                    >
                      <svg
                        class="w-4 h-4 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fill-rule="evenodd"
                          d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                          clip-rule="evenodd"
                        />
                      </svg>
                      <span>{project.city}{project.country
                        ? `, ${project.country}`
                        : ""}</span>
                    </div>

                    <!-- Description -->
                    <p
                      class="text-brand-navy-700/70 text-sm leading-relaxed mb-4 @3xs:mb-3 line-clamp-3"
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
                      <div class="flex-shrink-0 w-full @md:w-20 p-6 @md:p-8 @md:pr-4 @md:pl-0 flex flex-col items-start @md:items-end justify-start @3xs:p-4 @3xs:-mt-1">
                        <div class="flex flex-row @md:flex-col gap-3 items-start @md:items-end">
                          {#each sdgArray as sdgId}
                            <img
                              src="/sdgs/{sdgId}.svg"
                              alt={sdgId}
                              class="w-[60px] h-[60px] min-w-[60px] min-h-[60px] aspect-square rounded-lg object-cover block"
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
                <div class="w-full px-8 @3xs:px-6 pb-6">
                  <div class="w-full h-px bg-brand-navy-500/10 mb-4"></div>
                  <div class="flex justify-end gap-3">
                    <Button
                      variant="outline"
                      icon="mdi:pencil"
                      iconPosition="left"
                      onclick={() => {
                        goto(`?modal=edit-project&projectId=${project.id}`, { replaceState: false });
                      }}
                    >
                      Edit
                    </Button>
                    {#if isAdmin}
                      <Button
                        variant="alert"
                        icon="mdi:delete"
                        iconPosition="left"
                        onclick={() => requestDeleteProject(project.id)}
                      >
                        Delete
                      </Button>
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
