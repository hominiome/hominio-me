<script lang="ts">
  import { onMount } from "svelte";
  import { authClient } from "$lib/auth.client.js";
  import { useZero } from "$lib/zero-utils";
  import { getUserProfile, prefetchUserProfiles } from "$lib/userProfileCache";

  const zeroContext = useZero();
  const session = authClient.useSession();

  let zero: any = null;
  let cups = $state<any[]>([]);
  let loading = $state(true);
  let isAdmin = $state(false);
  let creatorProfiles = $state<
    Map<string, { name: string | null; image: string | null }>
  >(new Map());

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
    let cupsView: any;

    (async () => {
      // Wait for Zero to be ready
      while (!zeroContext.isReady() || !zeroContext.getInstance()) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      zero = zeroContext.getInstance();

      // Query ALL cups (everyone can read)
      const cupsQuery = zero.query.cup.orderBy("createdAt", "desc");
      cupsView = cupsQuery.materialize();

      cupsView.addListener(async (data: any) => {
        const newCups = Array.from(data || []);
        cups = newCups;
        loading = false;

        // Fetch creator profiles for all cups
        const creatorIds = [
          ...new Set(newCups.map((c: any) => c.creatorId).filter(Boolean)),
        ];
        if (creatorIds.length > 0) {
          await prefetchUserProfiles(creatorIds);
          const newCreatorProfiles = new Map(creatorProfiles);
          for (const creatorId of creatorIds) {
            const profile = await getUserProfile(creatorId);
            newCreatorProfiles.set(creatorId, {
              name: profile.name,
              image: profile.image,
            });
          }
          creatorProfiles = newCreatorProfiles;
        }
      });
    })();

    return () => {
      if (cupsView) cupsView.destroy();
    };
  });

  function getStatusColor(status: string) {
    switch (status) {
      case "draft":
        return "text-navy/50";
      case "active":
        return "text-teal";
      case "completed":
        return "text-yellow";
      default:
        return "text-navy/50";
    }
  }

  function getStatusLabel(status: string) {
    switch (status) {
      case "draft":
        return "Application Open";
      case "active":
        return "Active";
      case "completed":
        return "Completed";
      default:
        return status;
    }
  }

  function getRoundLabel(round: string) {
    switch (round) {
      case "round_16":
        return "Round of 16";
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
</script>

<div class="min-h-screen bg-cream p-8">
  <div class="max-w-7xl mx-auto">
    <!-- Header -->
    <div class="flex items-center justify-between mb-12">
          <div>
            <h1 class="text-6xl font-bold text-navy mb-3">Cups</h1>
            <p class="text-navy/60 text-lg">
              Tournament brackets where projects compete for victory
            </p>
          </div>

          {#if $session.data && isAdmin}
            <a href="/alpha/cups/create" class="btn-primary"> Create Cup </a>
          {/if}
    </div>

    {#if loading}
      <div class="card p-8 text-center">
        <p class="text-navy/70">Loading cups...</p>
      </div>
    {:else if cups.length === 0}
      <div class="card p-12 text-center">
        <h2 class="text-3xl font-bold text-navy mb-4">No Cups Yet</h2>
        <p class="text-navy/60 mb-6">
          {#if $session.data && isAdmin}
            Be the first to create a tournament cup!
          {:else}
            Check back soon for upcoming tournaments!
          {/if}
        </p>
        {#if $session.data && isAdmin}
          <a href="/alpha/cups/create" class="btn-primary">
            Create First Cup
          </a>
        {/if}
      </div>
    {:else}
      <!-- Cups Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {#each cups as cup}
          {@const creatorProfile = creatorProfiles.get(cup.creatorId)}
          {@const canEdit = isAdmin || cup.creatorId === $session.data?.user?.id}
          <div class="cup-card-wrapper">
            <a href="/alpha/cups/{cup.id}" class="cup-card">
            <!-- Status Badge -->
            <div class="flex items-center justify-between mb-4">
              <span class="status-badge {getStatusColor(cup.status)}">
                {getStatusLabel(cup.status)}
              </span>
              {#if cup.currentRound}
                <span class="round-badge"
                  >{getRoundLabel(cup.currentRound)}</span
                >
              {/if}
            </div>

            <!-- Cup Logo (if available) -->
            {#if cup.logoImageUrl}
              <div class="mb-4">
                <img
                  src={cup.logoImageUrl}
                  alt="{cup.name} logo"
                  class="cup-logo"
                />
              </div>
            {/if}

            <!-- Cup Name -->
            <h3 class="text-2xl font-bold text-navy mb-2">{cup.name}</h3>

            {#if cup.description}
              <p class="text-navy/60 mb-4 line-clamp-2">{cup.description}</p>
            {/if}

            <!-- Creator Info -->
            <div
              class="flex items-center justify-between mt-auto pt-4 border-t border-navy/10"
            >
              <div class="flex items-center gap-2">
                <svg
                  class="w-4 h-4 text-navy/50"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
                  />
                </svg>
                <span class="text-navy/60 text-sm">
                  {creatorProfile?.name || "Anonymous"}
                </span>
              </div>
              {#if canEdit}
                <div
                  class="edit-btn-inline"
                  onclick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.location.href = `/alpha/cups/${cup.id}/edit`;
                  }}
                  role="button"
                  tabindex="0"
                  onkeydown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      window.location.href = `/alpha/cups/${cup.id}/edit`;
                    }
                  }}
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </div>
              {/if}
            </div>

            {#if cup.completedAt && cup.winnerId}
              <div
                class="mt-3 p-3 bg-yellow/10 rounded-lg border border-yellow/30"
              >
                <div class="flex items-center gap-2">
                  <svg
                    class="w-5 h-5 text-yellow"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                    />
                  </svg>
                  <span class="text-yellow font-semibold">Winner Decided!</span>
                </div>
              </div>
            {/if}
          </a>
        </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .bg-cream {
    background-color: #fef9f0;
  }

  .btn-primary {
    padding: 0.75rem 2rem;
    background: linear-gradient(135deg, #4ecdc4 0%, #1a1a4e 100%);
    color: white;
    border-radius: 12px;
    font-weight: 600;
    font-size: 1rem;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
    text-decoration: none;
    display: inline-block;
  }

  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(78, 205, 196, 0.3);
  }

  .card {
    background: white;
    border-radius: 16px;
    box-shadow: 0 2px 12px rgba(26, 26, 78, 0.06);
    border: 1px solid rgba(26, 26, 78, 0.08);
  }

  .cup-card {
    background: white;
    border-radius: 16px;
    padding: 1.5rem;
    border: 2px solid rgba(26, 26, 78, 0.08);
    transition: all 0.3s;
    text-decoration: none;
    display: flex;
    flex-direction: column;
    min-height: 240px;
  }

  .cup-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 32px rgba(78, 205, 196, 0.15);
    border-color: rgba(78, 205, 196, 0.3);
  }

  .status-badge {
    padding: 0.375rem 0.75rem;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    background: rgba(26, 26, 78, 0.05);
  }

  .round-badge {
    padding: 0.375rem 0.75rem;
    border-radius: 8px;
    font-size: 0.75rem;
    font-weight: 600;
    background: rgba(78, 205, 196, 0.1);
    color: #4ecdc4;
  }

  .cup-logo {
    width: 100%;
    max-width: 120px;
    height: auto;
    border-radius: 8px;
    object-fit: contain;
  }

  .cup-card-wrapper {
    position: relative;
  }

  .edit-btn-inline {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.75rem;
    background: white;
    border: 2px solid rgba(26, 26, 78, 0.1);
    border-radius: 6px;
    color: #1a1a4e;
    font-size: 0.875rem;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.2s;
  }

  .edit-btn-inline:hover {
    border-color: #4ecdc4;
    color: #4ecdc4;
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(78, 205, 196, 0.2);
  }

  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .text-navy {
    color: #1a1a4e;
  }

  .text-teal {
    color: #4ecdc4;
  }

  .text-yellow {
    color: #f4d03f;
  }
</style>
