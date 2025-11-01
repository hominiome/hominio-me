<script lang="ts">
  import { onMount } from "svelte";
  import { authClient } from "$lib/auth.client.js";
  import { useZero } from "$lib/zero-utils";
  import { calculatePrizePool, formatPrizePool } from "$lib/prizePoolUtils.js";

  const zeroContext = useZero();
  const session = authClient.useSession();

  let zero: any = null;
  let cups = $state<any[]>([]);
  let purchases = $state<any[]>([]); // All identity purchases
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

  onMount(() => {
    let cupsView: any;
    let purchasesView: any;

    (async () => {
      // Wait for Zero to be ready
      while (!zeroContext.isReady() || !zeroContext.getInstance()) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      zero = zeroContext.getInstance();

      // Query ALL cups (everyone can read)
      const cupsQuery = zero.query.cup.orderBy("createdAt", "desc");
      cupsView = cupsQuery.materialize();

      // Query all identity purchases for prize pool calculation
      const purchasesQuery = zero.query.identityPurchase;
      purchasesView = purchasesQuery.materialize();

      purchasesView.addListener((data: any) => {
        purchases = Array.from(data || []);
      });

      cupsView.addListener((data: any) => {
        cups = Array.from(data || []);
        loading = false;
      });
    })();

    return () => {
      if (cupsView) cupsView.destroy();
      if (purchasesView) purchasesView.destroy();
    };
  });

  function getPrizePoolForCup(cupId: string): string {
    const cupPurchases = purchases.filter((p) => p.cupId === cupId);
    const totalCents = calculatePrizePool(cupPurchases);
    return formatPrizePool(totalCents);
  }

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
      <div class="cups-grid">
        {#each cups as cup}
          {@const canEdit =
            isAdmin || cup.creatorId === $session.data?.user?.id}
          <a href="/alpha/cups/{cup.id}" class="cup-card-new">
            <!-- Card Header -->
            <div class="cup-card-header">
              <div class="cup-header-top">
                <span class="status-badge-new status-{cup.status}">
                  {getStatusLabel(cup.status)}
                </span>
                <div class="cup-header-right">
                  {#if cup.currentRound}
                    <span class="round-badge-new">{getRoundLabel(cup.currentRound)}</span>
                  {/if}
                  {#if canEdit}
                    <div
                      class="cup-edit-btn-inline"
                      onclick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        window.location.href = `/alpha/cups/${cup.id}/edit`;
                      }}
                      role="button"
                      tabindex="0"
                      onkeydown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          window.location.href = `/alpha/cups/${cup.id}/edit`;
                        }
                      }}
                    >
                      <svg class="edit-icon-inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                      </svg>
                    </div>
                  {/if}
                </div>
              </div>
            </div>

            <!-- Cup Content -->
            <div class="cup-card-content">
              {#if cup.logoImageUrl}
                <div class="cup-logo-container">
                  <img
                    src={cup.logoImageUrl}
                    alt="{cup.name} logo"
                    class="cup-logo-new"
                  />
                </div>
              {/if}

              <h3 class="cup-title-new">{cup.name}</h3>

              {#if cup.description}
                <p class="cup-description">{cup.description}</p>
              {/if}
            </div>

            <!-- Prize Pool Footer -->
            <div class="cup-card-footer">
              <div class="prize-pool-badge-new">
                <svg class="prize-icon" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H10.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.39-2.1 1.39-1.6 0-2.23-.72-2.32-1.64H8.04c.1 1.7 1.36 2.66 2.86 2.97V19h2.34v-1.67c1.52-.29 2.72-1.16 2.73-2.77-.01-2.2-1.9-2.96-3.66-3.42z"/>
                </svg>
                <span class="prize-amount">{getPrizePoolForCup(cup.id)}</span>
              </div>
            </div>


            {#if cup.completedAt && cup.winnerId}
              <div class="cup-winner-badge">
                <svg class="winner-icon" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                <span>Winner Decided</span>
              </div>
            {/if}
          </a>
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

  /* Cup Cards Grid */
  .cups-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: 1.5rem;
    padding: 0;
  }

  .cup-card-new {
    background: white;
    border-radius: 16px;
    overflow: hidden;
    text-decoration: none;
    display: flex;
    flex-direction: column;
    position: relative;
    border: 2px solid rgba(26, 26, 78, 0.1);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 2px 8px rgba(26, 26, 78, 0.06);
    height: 100%;
  }

  .cup-card-new:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 32px rgba(26, 26, 78, 0.15);
    border-color: #4ecdc4;
  }

  /* Card Header */
  .cup-card-header {
    padding: 1rem 1.25rem;
    background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
    border-bottom: 2px solid rgba(26, 26, 78, 0.08);
  }

  .cup-header-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .cup-header-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .status-badge-new {
    padding: 0.375rem 0.75rem;
    border-radius: 8px;
    font-size: 0.6875rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    display: inline-block;
  }

  .status-badge-new.status-active {
    background: #d1fae5;
    color: #065f46;
    border: 1px solid #a7f3d0;
  }

  .status-badge-new.status-draft {
    background: #fef3c7;
    color: #92400e;
    border: 1px solid #fde68a;
  }

  .status-badge-new.status-completed {
    background: #e0e7ff;
    color: #3730a3;
    border: 1px solid #c7d2fe;
  }

  .round-badge-new {
    padding: 0.375rem 0.75rem;
    border-radius: 8px;
    font-size: 0.6875rem;
    font-weight: 700;
    background: linear-gradient(135deg, #4ecdc4 0%, #1a1a4e 100%);
    color: white;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    white-space: nowrap;
    box-shadow: 0 1px 3px rgba(26, 26, 78, 0.2);
  }

  /* Card Content */
  .cup-card-content {
    padding: 1.25rem 1.5rem;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
    min-height: 140px;
  }

  .cup-logo-container {
    display: flex;
    justify-content: center;
    align-items: center;
    margin-bottom: 0.25rem;
    padding: 0.5rem 0;
  }

  .cup-logo-new {
    max-width: 80px;
    max-height: 64px;
    width: auto;
    height: auto;
    object-fit: contain;
    border-radius: 8px;
  }

  .cup-title-new {
    font-size: 1.375rem;
    font-weight: 700;
    line-height: 1.3;
    color: #1a1a4e;
    margin: 0;
    letter-spacing: -0.01em;
  }

  .cup-description {
    font-size: 0.875rem;
    line-height: 1.5;
    color: #6b7280;
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* Card Footer */
  .cup-card-footer {
    padding: 1rem 1.5rem;
    background: linear-gradient(135deg, #fffef5 0%, #fef9f0 100%);
    border-top: 2px solid rgba(244, 208, 63, 0.2);
  }

  .prize-pool-badge-new {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.625rem;
    padding: 0.75rem 1rem;
    background: linear-gradient(135deg, #f4d03f 0%, #facc15 100%);
    border-radius: 12px;
    box-shadow: 0 2px 6px rgba(244, 208, 63, 0.25);
    border: 1px solid rgba(244, 208, 63, 0.3);
  }

  .prize-icon {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    color: #1a1a4e;
  }

  .prize-amount {
    font-size: 1.125rem;
    font-weight: 800;
    color: #1a1a4e;
    letter-spacing: -0.01em;
  }

  /* Edit Button Inline */
  .cup-edit-btn-inline {
    width: 32px;
    height: 32px;
    background: white;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
    border: 1px solid rgba(26, 26, 78, 0.15);
    flex-shrink: 0;
  }

  .cup-edit-btn-inline:hover {
    background: #4ecdc4;
    border-color: #4ecdc4;
    transform: scale(1.05);
    box-shadow: 0 2px 8px rgba(78, 205, 196, 0.3);
  }

  .edit-icon-inline {
    width: 16px;
    height: 16px;
    color: #1a1a4e;
    transition: color 0.2s;
  }

  .cup-edit-btn-inline:hover .edit-icon-inline {
    color: white;
  }

  /* Winner Badge */
  .cup-winner-badge {
    position: absolute;
    top: 1rem;
    left: 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 700;
    color: #1a1a4e;
    box-shadow: 0 2px 8px rgba(251, 191, 36, 0.3);
    z-index: 10;
  }

  .winner-icon {
    width: 16px;
    height: 16px;
    color: #1a1a4e;
  }

  /* Mobile Responsive */
  @media (max-width: 768px) {
    .cups-grid {
      grid-template-columns: 1fr;
      gap: 1.5rem;
    }

    .cup-card-new {
      border-radius: 16px;
    }

    .cup-card-content {
      padding: 1.25rem;
      min-height: 120px;
    }

    .cup-card-footer {
      padding: 1rem 1.25rem;
    }

    .cup-title-new {
      font-size: 1.25rem;
    }
  }

</style>
