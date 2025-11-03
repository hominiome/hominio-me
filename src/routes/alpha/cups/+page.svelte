<script lang="ts">
  import { onMount } from "svelte";
  import { authClient } from "$lib/auth.client.js";
  import { useZero } from "$lib/zero-utils";
  import { calculatePrizePool, formatPrizePool } from "$lib/prizePoolUtils.js";
  import { allCups, allMatches, allPurchases } from "$lib/synced-queries";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import Modal from "$lib/Modal.svelte";
  import CreateCupContent from "$lib/CreateCupContent.svelte";
  import EditCupContent from "$lib/EditCupContent.svelte";
  import { allProjects } from "$lib/synced-queries";
  import { Button, Icon } from "$lib/design-system/atoms";
  import { PageHeader, PageHeaderActions } from "$lib/design-system/molecules";
  import { Card } from "$lib/design-system/molecules";
  import CountdownTimer from "$lib/CountdownTimer.svelte";
  import { getMatchEndDate } from "$lib/dateUtils.js";

  const zeroContext = useZero();
  const session = authClient.useSession();

  let zero: any = null;
  let cups = $state<any[]>([]);
  let purchases = $state<any[]>([]); // All identity purchases
  let projects = $state<any[]>([]); // All projects (for winner display)
  let loading = $state(true);
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

  let matches = $state<any[]>([]); // All matches for countdown timer

  onMount(() => {
    let cupsView: any;
    let purchasesView: any;
    let projectsView: any;
    let matchesView: any;

    (async () => {
      // Wait for Zero to be ready
      while (!zeroContext.isReady() || !zeroContext.getInstance()) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      zero = zeroContext.getInstance();

      // Query ALL cups (everyone can read)
      const cupsQuery = allCups();
      cupsView = zero.materialize(cupsQuery);

      // Query all identity purchases for prize pool calculation
      const purchasesQuery = allPurchases();
      purchasesView = zero.materialize(purchasesQuery);

      // Query all projects (for winner display)
      const projectsQuery = allProjects();
      projectsView = zero.materialize(projectsQuery);

      // Query all matches for countdown timer
      const matchesQuery = allMatches();
      matchesView = zero.materialize(matchesQuery);

      purchasesView.addListener((data: any) => {
        purchases = Array.from(data || []);
      });

      projectsView.addListener((data: any) => {
        projects = Array.from(data || []);
      });

      matchesView.addListener((data: any) => {
        matches = Array.from(data || []);
      });

      cupsView.addListener((data: any) => {
        cups = Array.from(data || []);
        loading = false;
      });
    })();

    return () => {
      if (cupsView) cupsView.destroy();
      if (purchasesView) purchasesView.destroy();
      if (projectsView) projectsView.destroy();
      if (matchesView) matchesView.destroy();
    };
  });

  function getPrizePoolForCup(cupId: string): string {
    const cupPurchases = purchases.filter((p) => p.cupId === cupId);
    const totalCents = calculatePrizePool(cupPurchases);
    return formatPrizePool(totalCents);
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

  // Detect modal params from URL
  const showCreateModal = $derived(
    $page.url.searchParams.get("modal") === "create-cup"
  );
  const showEditModal = $derived(
    $page.url.searchParams.get("modal") === "edit-cup"
  );
  const editCupId = $derived($page.url.searchParams.get("cupId") || "");

  function handleCreateModalClose() {
    const url = new URL($page.url);
    url.searchParams.delete("modal");
    goto(url.pathname + url.search, { replaceState: true });
  }

  function handleEditModalClose() {
    const url = new URL($page.url);
    url.searchParams.delete("modal");
    url.searchParams.delete("cupId");
    goto(url.pathname + url.search, { replaceState: true });
  }

  function handleCreateSuccess(cupId: string) {
    handleCreateModalClose();
    goto(`/alpha/cups/${cupId}/admin`);
  }

  function handleEditSuccess() {
    handleEditModalClose();
  }
</script>

<div class="@container min-h-screen py-8">
  <!-- Sticky Header -->
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
        title="Cups"
        subtitle="Tournament brackets where projects compete for victory"
        size="sm"
      />
      {#if $session.data && isAdmin}
        <PageHeaderActions>
          {#snippet children()}
            <Button
              variant="primary"
              icon="mdi:plus"
              iconPosition="left"
              onclick={() => {
                const url = new URL($page.url);
                url.searchParams.set("modal", "create-cup");
                goto(url.pathname + url.search, { replaceState: false });
              }}
            >
              Create Cup
            </Button>
          {/snippet}
        </PageHeaderActions>
      {/if}
    </div>
  </div>

  {#if loading}
    <div
      class="bg-white rounded-2xl border-2 border-brand-navy-500/6 shadow-md p-8 text-center"
    >
      <p class="text-brand-navy-700/70">Loading cups...</p>
    </div>
  {:else if cups.length === 0}
    <div
      class="bg-white rounded-2xl border-2 border-brand-navy-500/6 shadow-md p-12 text-center"
    >
      <h2 class="text-3xl font-bold text-primary-500 mb-4">No Cups Yet</h2>
      <p class="text-primary-700/60 mb-6">
        {#if $session.data && isAdmin}
          Be the first to create a tournament cup!
        {:else}
          Check back soon for upcoming tournaments!
        {/if}
      </p>
      {#if $session.data && isAdmin}
        <Button
          variant="primary"
          icon="mdi:plus"
          iconPosition="left"
          onclick={() => {
            const url = new URL($page.url);
            url.searchParams.set("modal", "create-cup");
            goto(url.pathname + url.search, { replaceState: false });
          }}
        >
          Create First Cup
        </Button>
      {/if}
    </div>
  {:else}
    <!-- Cups Grid - Big List Items Layout -->
    <div class="flex flex-col gap-6 w-full">
      {#each cups as cup}
        {@const canEdit = isAdmin || cup.creatorId === $session.data?.user?.id}
        {@const prizePool = getPrizePoolForCup(cup.id)}
        {@const winnerProject = cup.winnerId
          ? projects.find((p) => p.id === cup.winnerId)
          : null}
        {@const cupMatches = matches.filter((m) => m.cupId === cup.id)}
        {@const currentRoundMatch = cupMatches.find(
          (m) =>
            m.status === "voting" ||
            (m.status === "pending" && cup.status === "active")
        )}
        {@const roundEndDate = currentRoundMatch
          ? getMatchEndDate(currentRoundMatch, cupMatches)
          : null}
        {@const participatingProjectIds = Array.from(
          new Set(
            cupMatches
              .flatMap((m) => [m.project1Id, m.project2Id])
              .filter((id) => id && id.trim())
          )
        )}
        {@const participatingProjects = participatingProjectIds
          .map((id) => projects.find((p) => p.id === id))
          .filter((p) => p)
          .sort(() => Math.random() - 0.5)}

        <a href="/alpha/cups/{cup.id}" class="group relative block w-full">
          <Card
            variant="default"
            class="w-full min-h-[180px] @md:min-h-[280px] overflow-hidden"
          >
            <!-- Big List Item Layout: Square Left Section + Right Content -->
            <div class="flex flex-col @md:flex-row @md:min-h-[280px]">
              <!-- Left Square Section - Full Height with Champion/Prize Pool -->
              <div
                class="w-full @md:w-[280px] @md:min-w-[280px] @md:self-stretch h-[140px] @md:h-auto @md:aspect-auto flex flex-col items-center justify-center p-3 @md:p-8 border-r-0 @md:border-r-2 border-b-2 @md:border-b-0
                  {cup.status === 'completed' && winnerProject
                  ? 'bg-gradient-to-br from-[#ffd700] to-[#ffed4e] border-accent-200/50'
                  : cup.status === 'active'
                    ? 'bg-gradient-to-br from-secondary-500/20 via-secondary-400/15 to-secondary-500/20 border-secondary-300/40'
                    : 'bg-gradient-to-br from-accent-50 to-accent-100/50 border-accent-200/50'}"
              >
                {#if cup.status === "completed" && winnerProject}
                  <!-- Winner Display -->
                  <div
                    class="flex flex-col items-center gap-1.5 @md:gap-4 text-center"
                  >
                    <div
                      class="w-10 h-10 @md:w-20 @md:h-20 rounded-full bg-gradient-to-br from-accent-400 to-accent-500 flex items-center justify-center shadow-lg shrink-0"
                    >
                      <Icon
                        name="mdi:trophy"
                        size={20}
                        class="@md:hidden"
                        color="white"
                      />
                      <Icon
                        name="mdi:trophy"
                        size="xl"
                        class="hidden @md:block"
                        color="white"
                      />
                    </div>
                    <div>
                      <div
                        class="text-[10px] @md:text-xs font-bold text-accent-900 uppercase tracking-wider mb-0.5 @md:mb-1"
                      >
                        Champion
                      </div>
                      <div
                        class="text-xs @md:text-xl font-bold text-accent-800 line-clamp-2"
                      >
                        {winnerProject.title}
                      </div>
                    </div>
                  </div>
                {:else if cup.status === "active"}
                  <!-- Active Cup - Redesigned Prize Pool Display -->
                  <div
                    class="flex flex-col items-center gap-2 @md:gap-5 text-center"
                  >
                    <div
                      class="w-12 h-12 @md:w-24 @md:h-24 rounded-full bg-gradient-to-br from-secondary-500 to-secondary-600 flex items-center justify-center shadow-xl shrink-0 ring-2 @md:ring-4 ring-secondary-200/50"
                    >
                      <Icon
                        name="mdi:currency-usd"
                        size={18}
                        class="@md:hidden"
                        color="white"
                      />
                      <Icon
                        name="mdi:currency-usd"
                        size="xl"
                        class="hidden @md:block"
                        color="white"
                      />
                    </div>
                    <div class="space-y-0.5 @md:space-y-1">
                      <div
                        class="text-[10px] @md:text-xs font-bold text-secondary-800 uppercase tracking-wider"
                      >
                        Prize Pool
                      </div>
                      <div
                        class="text-base @md:text-4xl font-black text-secondary-700 leading-none"
                      >
                        {prizePool}
                      </div>
                    </div>
                  </div>
                {:else}
                  <!-- Draft Cup - Prize Pool Display -->
                  <div
                    class="flex flex-col items-center gap-1.5 @md:gap-4 text-center"
                  >
                    <div
                      class="w-10 h-10 @md:w-20 @md:h-20 rounded-full bg-gradient-to-br from-accent-400 to-accent-500 flex items-center justify-center shadow-lg shrink-0"
                    >
                      <Icon
                        name="mdi:currency-usd"
                        size={18}
                        class="@md:hidden"
                        color="white"
                      />
                      <Icon
                        name="mdi:currency-usd"
                        size="xl"
                        class="hidden @md:block"
                        color="white"
                      />
                    </div>
                    <div>
                      <div
                        class="text-[10px] @md:text-xs font-semibold text-accent-900 uppercase tracking-wider mb-0.5 @md:mb-1"
                      >
                        Prize Pool
                      </div>
                      <div
                        class="text-sm @md:text-3xl font-bold text-accent-800"
                      >
                        {prizePool}
                      </div>
                    </div>
                  </div>
                {/if}
              </div>

              <!-- Right Content Section -->
              <div
                class="flex-1 p-4 @md:p-8 flex flex-col relative @md:self-stretch"
              >
                <!-- Title at Top -->
                <div class="flex items-start justify-between mb-2 @md:mb-3">
                  <h3
                    class="text-xl @md:text-3xl font-bold text-primary-500 line-clamp-2 flex-1"
                  >
                    {cup.name}
                  </h3>
                  {#if canEdit}
                    <Button
                      variant="outline"
                      icon="mdi:pencil"
                      iconPosition="left"
                      onclick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const url = new URL($page.url);
                        url.searchParams.set("modal", "edit-cup");
                        url.searchParams.set("cupId", cup.id);
                        goto(url.pathname + url.search, {
                          replaceState: false,
                        });
                      }}
                      class="aspect-square p-1.5 w-8 h-8 @md:w-10 @md:h-10 !px-1.5 @md:!px-2 ml-2 @md:ml-3 shrink-0"
                      aria-label="Edit cup"
                    ></Button>
                  {/if}
                </div>

                <!-- Description -->
                {#if cup.description}
                  <p
                    class="text-sm @md:text-base text-primary-700/70 mb-4 line-clamp-2"
                  >
                    {cup.description}
                  </p>
                {/if}

                <!-- Metadata Badges -->
                <div class="flex flex-wrap items-center gap-2 mb-4">
                  <!-- Status Badge -->
                  <span
                    class="px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider
                      {cup.status === 'active'
                      ? 'bg-success-100 text-success-700 border border-success-300'
                      : ''}
                      {cup.status === 'draft'
                      ? 'bg-warning-100 text-warning-700 border border-warning-300'
                      : ''}
                      {cup.status === 'completed'
                      ? 'bg-info-100 text-info-700 border border-info-300'
                      : ''}"
                  >
                    {getStatusLabel(cup.status)}
                  </span>

                  <!-- Round Badge -->
                  {#if cup.currentRound}
                    <span
                      class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-secondary-500/10 rounded-full border border-secondary-300/30"
                    >
                      <Icon
                        name="mdi:tournament"
                        size="xs"
                        color="var(--color-secondary-600)"
                      />
                      <span
                        class="text-xs font-semibold text-secondary-700 uppercase tracking-wider"
                      >
                        {getRoundLabel(cup.currentRound)}
                      </span>
                    </span>
                  {/if}

                  <!-- Time Remaining Badge -->
                  {#if cup.status === "active" && roundEndDate}
                    <span
                      class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-secondary-500/10 rounded-full border border-secondary-300/30"
                    >
                      <Icon
                        name="mdi:clock-outline"
                        size="xs"
                        color="var(--color-secondary-600)"
                      />
                      <span class="text-xs font-semibold text-secondary-700">
                        <CountdownTimer
                          endDate={roundEndDate}
                          displayFormat="compact"
                        />
                      </span>
                    </span>
                  {/if}
                </div>

                <!-- Divider Line -->
                {#if participatingProjects.length > 0}
                  <div class="border-t border-brand-navy-500/10 my-4"></div>
                {/if}

                <!-- Participating Projects Profile Images -->
                {#if participatingProjects.length > 0}
                  <div class="flex flex-col gap-2 mt-auto">
                    <span
                      class="text-xs font-semibold text-primary-700/60 uppercase tracking-wider"
                    >
                      Participants:
                    </span>
                    <div class="flex flex-wrap items-center gap-2">
                      {#each participatingProjects as project}
                        <a
                          href="/alpha/projects/{project.id}"
                          class="relative"
                          onclick={(e) => e.stopPropagation()}
                        >
                          {#if project.bannerImage || project.profileImageUrl}
                            <img
                              src={project.profileImageUrl ||
                                project.bannerImage ||
                                `https://picsum.photos/seed/${project.id}/64/64`}
                              alt={project.title}
                              class="w-10 h-10 rounded-full object-cover border-2 border-secondary-200 hover:border-secondary-500 transition-colors shadow-sm"
                              onerror={(e) => {
                                const target = e.target as HTMLImageElement;
                                if (target)
                                  target.src = `https://picsum.photos/seed/${project.id}/64/64`;
                              }}
                            />
                          {:else}
                            <div
                              class="w-10 h-10 rounded-full bg-gradient-to-br from-secondary-400 to-secondary-500 flex items-center justify-center border-2 border-secondary-200 hover:border-secondary-500 transition-colors shadow-sm text-white font-bold text-xs"
                            >
                              {project.title?.[0]?.toUpperCase() || "?"}
                            </div>
                          {/if}
                        </a>
                      {/each}
                    </div>
                  </div>
                {/if}
              </div>
            </div>
          </Card>
        </a>
      {/each}
    </div>
  {/if}
</div>

<!-- Create Cup Modal -->
{#if showCreateModal && $session.data?.user}
  <Modal open={showCreateModal} onClose={handleCreateModalClose}>
    <CreateCupContent onSuccess={handleCreateSuccess} />
  </Modal>
{/if}

<!-- Edit Cup Modal -->
{#if showEditModal && $session.data?.user && editCupId}
  <Modal open={showEditModal} onClose={handleEditModalClose}>
    <EditCupContent cupId={editCupId} onSuccess={handleEditSuccess} />
  </Modal>
{/if}
