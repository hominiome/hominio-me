<script lang="ts">
  import { onMount } from "svelte";
  import { authClient } from "$lib/auth.client.js";
  import { useZero } from "$lib/zero-utils";
  import { showError } from "$lib/toastStore.js";
  import UserAutocomplete from "$lib/UserAutocomplete.svelte";
  import CountryAutocomplete from "$lib/CountryAutocomplete.svelte";
  import TigrisImageUpload from "$lib/components/TigrisImageUpload.svelte";
  import { projectById } from "$lib/synced-queries";
  import { getUserProfile } from "$lib/userProfileCache";

  let { projectId, onSuccess } = $props<{
    projectId: string;
    onSuccess?: () => void;
  }>();

  const zeroContext = useZero();
  const session = authClient.useSession();

  let zero: any = null;
  let project = $state<any>(null);
  let loading = $state(true);
  let saving = $state(false);
  let isAdmin = $state(false);
  let checking = $state(true);

  // Form state
  let editFormData = $state({
    title: "",
    description: "",
    country: null as { name: string } | null,
    city: "",
    videoUrl: "",
    bannerImage: "",
    profileImageUrl: "",
    sdgs: [] as string[],
  });
  let editSelectedOwner = $state<{
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
      checking = false;
    })();
  });

  onMount(() => {
    let projectView: any;

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

      projectView.addListener((data: any) => {
        const projects = Array.from(data);
        if (projects.length > 0) {
          project = projects[0];
          // Populate form
          editFormData = {
            title: project.title || "",
            description: project.description || "",
            country: project.country ? { name: project.country } : null,
            city: project.city || "",
            videoUrl: project.videoUrl || "",
            bannerImage: project.bannerImage || "",
            profileImageUrl: project.profileImageUrl || "",
            sdgs: project.sdgs
              ? typeof project.sdgs === "string"
                ? JSON.parse(project.sdgs || "[]")
                : project.sdgs
              : [],
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
          loading = false;
        } else if (project === null) {
          loading = false;
        }
      });
    })();

    return () => {
      if (projectView) projectView.destroy();
    };
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
    if (
      !project ||
      saving ||
      !editFormData.title.trim() ||
      !editFormData.description.trim() ||
      !editFormData.country ||
      !editFormData.city.trim() ||
      editFormData.sdgs.length === 0
    ) {
      return;
    }

    saving = true;

    try {
      // Build update args - only include userId if admin is changing it to a different user
      const updateArgs: any = {
        id: project.id,
        title: editFormData.title.trim(),
        description: editFormData.description.trim(),
        country: editFormData.country?.name || editFormData.country || "",
        city: editFormData.city.trim(),
        videoUrl: (editFormData.videoUrl || "").trim(),
        bannerImage: (editFormData.bannerImage || "").trim(),
        profileImageUrl: (editFormData.profileImageUrl || "").trim(),
        sdgs: JSON.stringify(editFormData.sdgs),
      };
      
      // Only include userId if admin is changing it to a different user
      // Otherwise, don't send userId - server will keep the current owner
      if (isAdmin && editSelectedOwner && editSelectedOwner.id !== project.userId) {
        updateArgs.userId = editSelectedOwner.id;
      }

      zero.mutate.project.update(updateArgs);

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Failed to update project:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      showError(`Failed to update project: ${message}`);
    } finally {
      saving = false;
    }
  }

  const canEditProject = $derived(
    project &&
      editFormData.title.trim() &&
      editFormData.description.trim() &&
      editFormData.country &&
      editFormData.city.trim() &&
      editFormData.sdgs.length > 0 &&
      !saving
  );

  // Expose for layout - use requestAnimationFrame to debounce updates
  let rafId: number | null = null;
  $effect(() => {
    // Access reactive values at effect level to ensure tracking
    const canEdit = canEditProject;
    const isSaving = saving;

    if (typeof window !== "undefined") {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => {
        (window as any).__projectModalActions = {
          canEditProject: canEdit,
          editSaving: isSaving,
          handleEditSubmit: () => {
            const form = document.getElementById("edit-project-form") as HTMLFormElement;
            if (form && canEditProject) {
              form.requestSubmit();
            }
          },
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
</script>

<div class="edit-project-content">
  <h2 class="text-3xl font-bold text-brand-navy-700 mb-6">Edit Project</h2>

  {#if loading || checking}
    <div class="text-center py-8">
      <p class="text-brand-navy-500/70">Loading project...</p>
    </div>
  {:else if !project}
    <div class="text-center py-8">
      <p class="text-brand-navy-500/70">Project not found</p>
      <p class="text-xs text-brand-navy-500/50 mt-2">Project ID: {projectId}</p>
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
          class="block text-brand-navy-500/80 font-medium mb-2"
          >Title *</label
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
          class="block text-brand-navy-500/80 font-medium mb-2"
          >Description *</label
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
          class="block text-brand-navy-500/80 font-medium mb-2"
          >City *</label
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
        <div class="block text-brand-navy-500/80 font-medium mb-2">
          Profile Image (Optional)
        </div>
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
        <div class="block text-brand-navy-500/80 font-medium mb-2">
          Banner Image (Optional)
        </div>
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
        <div
          class="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-3 p-2 bg-brand-teal-500/3 rounded-xl overflow-visible max-h-none"
        >
          {#each availableSDGs as sdg}
            <button
              type="button"
              onclick={() => toggleEditSDG(sdg.id)}
              class="relative aspect-square border-[3px] border-transparent rounded-lg cursor-pointer transition-all duration-200 p-0 bg-white overflow-hidden {editFormData.sdgs.includes(
                sdg.id
              )
                ? 'border-brand-yellow-500 shadow-[0_4px_16px_rgba(244,208,63,0.3)]'
                : 'hover:scale-105 hover:border-brand-teal-500 hover:shadow-[0_4px_12px_rgba(78,205,196,0.2)]'} {!editFormData.sdgs.includes(
                sdg.id
              ) && editFormData.sdgs.length >= 3
                ? 'opacity-40 cursor-not-allowed'
                : ''}"
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
  {/if}
</div>

<style>
  .edit-project-content {
    width: 100%;
    overflow: visible;
  }
</style>

