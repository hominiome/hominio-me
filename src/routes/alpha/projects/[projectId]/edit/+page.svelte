<script lang="ts">
  import { onMount } from "svelte";
  import { authClient } from "$lib/auth.client.js";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { getContext } from "svelte";
  import { nanoid } from "nanoid";
  import UserAutocomplete from "$lib/UserAutocomplete.svelte";
  import CountryAutocomplete from "$lib/CountryAutocomplete.svelte";
  import { getUserProfile } from "$lib/userProfileCache";
  import { showError } from "$lib/toastStore.js";
  import { projectById } from "$lib/synced-queries";

  const zeroContext = getContext<{
    getInstance: () => any;
    isReady: () => boolean;
  }>("zero");

  const session = authClient.useSession();
  const projectId = $page.params.projectId;

  let zero: any = null;
  let project = $state<any>(null);
  let loading = $state(true);
  let saving = $state(false);
  let isAdmin = $state(false);
  let isOwner = $state(false);
  let checking = $state(true);

  // Form state
  let title = $state("");
  let description = $state("");
  let country = $state<{ name: string } | null>(null);
  let city = $state("");
  let videoUrl = $state("");
  let bannerImage = $state("");
  let sdgs = $state<string[]>([]);
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
    if (sdgs.includes(sdgId)) {
      sdgs = sdgs.filter((id) => id !== sdgId);
    } else {
      if (sdgs.length < 3) {
        sdgs = [...sdgs, sdgId];
      }
    }
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
      } else if (!$session.isPending && !$session.data?.user) {
        // Not logged in - redirect immediately
        goto(`/alpha/projects`);
        return;
      }
      checking = false;
    })();
  });

  onMount(() => {
    if (!zeroContext) {
      console.error("Zero context not found");
      loading = false;
      return;
    }

    let projectView: any;

    // Wait for Zero to be ready
    const checkZero = setInterval(() => {
      if (zeroContext.isReady() && zeroContext.getInstance()) {
        clearInterval(checkZero);
        zero = zeroContext.getInstance();

        // Query project using synced query
        const projectQuery = projectById(projectId);
        projectView = zero.materialize(projectQuery);

        projectView.addListener((data: any) => {
          const projects = Array.from(data);
          if (projects.length > 0) {
            project = projects[0];

            // Populate form
            title = project.title || "";
            description = project.description || "";
            country = project.country ? { name: project.country } : null;
            city = project.city || "";
            videoUrl = project.videoUrl || "";
            bannerImage = project.bannerImage || "";

            // Parse SDGs
            if (project.sdgs) {
              try {
                sdgs =
                  typeof project.sdgs === "string"
                    ? JSON.parse(project.sdgs || "[]")
                    : project.sdgs;
              } catch {
                sdgs = [];
              }
            }

            // Load current owner
            if (project.userId) {
              getUserProfile(project.userId).then((profile) => {
                selectedOwner = {
                  id: profile.id,
                  name: profile.name,
                  image: profile.image,
                };
              });
            }

            // Check if user is owner (for display purposes)
            isOwner = project.userId === $session.data?.user?.id;

            // Wait for admin check to complete, then verify access
            if (!checking) {
              // Only admins can access the edit page
              if (!isAdmin) {
                goto(`/alpha/projects`);
                return;
              }
              loading = false;
            }
          } else if (project === null) {
            loading = false;
          }
        });
      }
    }, 100);

    return () => {
      clearInterval(checkZero);
      if (projectView) projectView.destroy();
    };
  });

  async function updateProject() {
    if (
      !project ||
      saving ||
      !title.trim() ||
      !description.trim() ||
      !country ||
      !city.trim() ||
      sdgs.length === 0
    ) {
      return;
    }

    // Only admins can update projects
    if (!isAdmin) {
      showError("Only admins can update projects");
      return;
    }

    // Only admins can change project owner
    const newUserId = selectedOwner ? selectedOwner.id : project.userId;

    saving = true;

    try {
      // Use Zero custom mutator for project update
      // Fire and forget - Zero handles optimistic updates
      zero.mutate.project.update({
        id: project.id,
        title: title.trim(),
        description: description.trim(),
        country: country.name,
        city: city.trim(),
        videoUrl: videoUrl.trim() || "",
        bannerImage: bannerImage.trim() || "",
        profileImageUrl: project.profileImageUrl || "", // Preserve existing profile image
        sdgs: JSON.stringify(sdgs),
        userId: newUserId, // Update owner if admin changed it
      });

      // Redirect back to projects page
      goto(`/alpha/projects`);
    } catch (error) {
      console.error("Failed to update project:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      showError(`Failed to update project: ${message}`);
    } finally {
      saving = false;
    }
  }
</script>

<div class="min-h-screen bg-cream p-8">
  <div class="max-w-3xl mx-auto">
    <!-- Header -->
    <div class="mb-8">
      <a
        href="/alpha/projects"
        class="text-teal hover:underline mb-4 inline-block"
      >
        ← Back to Projects
      </a>
      <h1 class="text-6xl font-bold text-navy mb-3">Edit Project</h1>
      <p class="text-navy/60 text-lg">Update your project details</p>
    </div>

    {#if loading || checking}
      <div class="card p-8 text-center">
        <p class="text-navy/70">Loading project...</p>
      </div>
    {:else if !project}
      <div class="card p-8 text-center">
        <p class="text-navy/70">Project not found</p>
      </div>
    {:else}
      <form
        onsubmit={(e) => {
          e.preventDefault();
          updateProject();
        }}
        class="card p-8 space-y-5"
      >
        <!-- Title -->
        <div>
          <label for="project-title" class="block text-navy/80 font-medium mb-2"
            >Title *</label
          >
          <input
            id="project-title"
            type="text"
            bind:value={title}
            placeholder="My Amazing Project"
            class="input w-full"
            required
          />
        </div>

        <!-- Description -->
        <div>
          <label
            for="project-description"
            class="block text-navy/80 font-medium mb-2">Description *</label
          >
          <textarea
            id="project-description"
            bind:value={description}
            placeholder="Tell us about your project..."
            rows="4"
            class="input w-full"
            required
          ></textarea>
        </div>

        <!-- Country -->
        <div>
          <CountryAutocomplete
            bind:value={country}
            label="Country"
            placeholder="Select a country..."
            required
          />
        </div>

        <!-- City -->
        <div>
          <label for="project-city" class="block text-navy/80 font-medium mb-2"
            >City *</label
          >
          <input
            id="project-city"
            type="text"
            bind:value={city}
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
            bind:value={videoUrl}
            placeholder="https://www.youtube.com/watch?v=..."
            class="input w-full"
          />
          <p class="text-sm text-navy/60 mt-1">
            Add a YouTube link for your project pitch video
          </p>
        </div>

        <!-- Banner Image URL (Optional) -->
        <div>
          <label
            for="project-bannerImage"
            class="block text-navy/80 font-medium mb-2"
          >
            Banner Image URL (Optional)
          </label>
          <input
            id="project-bannerImage"
            type="url"
            bind:value={bannerImage}
            placeholder="https://example.com/banner.jpg"
            class="input w-full"
          />
          <p class="text-sm text-navy/60 mt-1">
            Custom banner image (falls back to Unsplash if not provided)
          </p>
        </div>

        <!-- Project Owner -->
        <div>
          <UserAutocomplete
            bind:value={selectedOwner}
            label="Project Owner"
            placeholder="Search for a user..."
            disabled={!isAdmin}
          />
          <p class="text-sm text-navy/60 mt-1">
            {#if isAdmin}
              Change the project owner (admin only)
            {:else}
              Project owner (only admins can change this)
            {/if}
          </p>
        </div>

        <!-- SDG Selection -->
        <div>
          <label for="project-sdgs" class="block text-navy/80 font-medium mb-2">
            SDG Goals * (Select 1-3)
          </label>
          <p class="text-sm text-navy/60 mb-3">
            Selected: {sdgs.length}/3
          </p>
          <div class="sdg-grid">
            {#each availableSDGs as sdg}
              <button
                type="button"
                onclick={() => toggleSDG(sdg.id)}
                class="sdg-selector {sdgs.includes(sdg.id) ? 'selected' : ''}"
                disabled={!sdgs.includes(sdg.id) && sdgs.length >= 3}
                title={sdg.name}
              >
                <img
                  src="/sdgs/{sdg.id}.svg"
                  alt={sdg.name}
                  class="sdg-image"
                />
                {#if sdgs.includes(sdg.id)}
                  <div class="sdg-checkmark">✓</div>
                {/if}
              </button>
            {/each}
          </div>
        </div>

        <!-- Actions -->
        <div class="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving ||
              !title.trim() ||
              !description.trim() ||
              !country ||
              !city.trim() ||
              sdgs.length === 0}
            class="btn-primary px-8 py-3 flex-1"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <a href="/alpha/projects" class="btn-secondary px-8 py-3"> Cancel </a>
        </div>
      </form>
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
    border: 1px solid rgba(26, 26, 78, 0.08);
    box-shadow: 0 2px 12px rgba(26, 26, 78, 0.06);
  }

  .input {
    padding: 0.875rem 1rem;
    background: white;
    border: 2px solid rgba(26, 26, 78, 0.1);
    border-radius: 10px;
    color: #1a1a4e;
    transition: all 0.2s ease;
    font-size: 0.9375rem;
    width: 100%;
  }

  .input:focus {
    outline: none;
    border-color: #4ecdc4;
    box-shadow: 0 0 0 3px rgba(78, 205, 196, 0.1);
  }

  .btn-primary {
    background: #1a1a4e;
    color: white;
    border-radius: 12px;
    font-weight: 600;
    transition: all 0.2s ease;
    border: none;
    cursor: pointer;
  }

  .btn-primary:hover:not(:disabled) {
    background: #2a2a6e;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(26, 26, 78, 0.3);
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: white;
    color: #1a1a4e;
    border-radius: 12px;
    border: 2px solid rgba(26, 26, 78, 0.1);
    font-weight: 600;
    transition: all 0.2s ease;
    text-decoration: none;
    display: inline-block;
  }

  .btn-secondary:hover {
    border-color: #4ecdc4;
    color: #4ecdc4;
  }

  .sdg-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: 1rem;
    margin-top: 1rem;
  }

  .sdg-selector {
    position: relative;
    aspect-ratio: 1;
    border: 2px solid rgba(26, 26, 78, 0.1);
    border-radius: 12px;
    background: white;
    cursor: pointer;
    transition: all 0.2s ease;
    padding: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .sdg-selector:hover:not(:disabled) {
    border-color: #4ecdc4;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(78, 205, 196, 0.2);
  }

  .sdg-selector.selected {
    border-color: #4ecdc4;
    background: rgba(78, 205, 196, 0.1);
  }

  .sdg-selector:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .sdg-image {
    width: 100%;
    height: auto;
  }

  .sdg-checkmark {
    position: absolute;
    top: 0.25rem;
    right: 0.25rem;
    background: #4ecdc4;
    color: white;
    border-radius: 50%;
    width: 1.5rem;
    height: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.875rem;
    font-weight: bold;
  }

  .text-teal {
    color: #4ecdc4;
  }

  .text-navy {
    color: #1a1a4e;
  }
</style>
