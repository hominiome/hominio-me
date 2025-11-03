<script>
  import { calculatePrizePool, formatPrizePool } from "$lib/prizePoolUtils.js";
  import { getMatchEndDate } from "$lib/dateUtils.js";
  import CountdownTimer from "$lib/CountdownTimer.svelte";

  let { cup, purchases = [], matches = [] } = $props();

  // Helper function to get round label
  function getRoundLabel(round) {
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

  // Get prize pool for cup
  function getPrizePoolForCup(cupId) {
    const cupPurchases = purchases.filter((p) => p.cupId === cupId);
    return formatPrizePool(calculatePrizePool(cupPurchases));
  }

  // Get round end date from matches
  const cupMatches = $derived(matches.filter((m) => m.cupId === cup?.id));
  const currentRoundMatch = $derived(
    cupMatches.find(
      (m) =>
        m.status === "voting" ||
        (m.status === "pending" && cup?.status === "active")
    )
  );
  const roundEndDate = $derived(
    currentRoundMatch ? getMatchEndDate(currentRoundMatch, cupMatches) : null
  );
</script>

{#if cup}
  <div class="cup-header-wrapper">
    <div class="cup-header">
      <h3 class="cup-header-title">{cup.name}</h3>
      <div class="cup-header-badges">
        <div class="cup-badge prize-pool-badge">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H10.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.39-2.1 1.39-1.6 0-2.23-.72-2.32-1.64H8.04c.1 1.7 1.36 2.66 2.86 2.97V19h2.34v-1.67c1.52-.29 2.72-1.16 2.73-2.77-.01-2.2-1.9-2.96-3.66-3.42z"
            />
          </svg>
          <span>{getPrizePoolForCup(cup.id)} Prize Pool</span>
        </div>
        <span class="cup-badge cup-round-badge"
          >{getRoundLabel(cup.currentRound || "round_8")}</span
        >
        {#if roundEndDate}
          <div class="cup-badge cup-countdown-badge">
            <CountdownTimer endDate={roundEndDate} displayFormat="compact" />
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .cup-header-wrapper {
    display: flex;
    justify-content: center;
    width: 100%;
    margin-bottom: 1rem;
    max-width: 100%;
  }

  .cup-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 1.5rem 2rem;
    background: rgba(45, 166, 180, 0.12);
    border-radius: 16px;
    border: 2px solid rgba(45, 166, 180, 0.2);
    box-shadow:
      0 4px 16px rgba(8, 27, 71, 0.08),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
    width: 100%;
    max-width: 100%;
  }

  .cup-header-title {
    font-size: 1.5rem;
    font-weight: 800;
    color: #081b47;
    margin: 0;
    letter-spacing: -0.02em;
    text-align: center;
  }

  .cup-header-badges {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .cup-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    white-space: nowrap;
    border-radius: 9999px;
    border: 1px solid rgba(45, 166, 180, 0.2);
  }

  .prize-pool-badge {
    background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%);
    color: #1a1a4e;
    font-weight: 700;
    box-shadow: 0 2px 8px rgba(255, 215, 0, 0.3);
  }

  .prize-pool-badge svg {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
    fill: #1a1a4e;
  }

  .cup-round-badge {
    background: rgba(45, 166, 180, 0.1);
    color: #081b47;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .cup-countdown-badge {
    background: rgba(45, 166, 180, 0.1);
    color: #081b47;
  }

  .cup-countdown-badge :global(*) {
    color: #081b47;
    font-size: 0.875rem;
    font-weight: 600;
  }

  @media (max-width: 768px) {
    .cup-header {
      padding: 1.25rem 1.5rem;
      gap: 0.875rem;
    }

    .cup-header-title {
      font-size: 1.25rem;
    }

    .cup-header-badges {
      gap: 0.625rem;
    }

    .cup-badge {
      padding: 0.4375rem 0.875rem;
      font-size: 0.8125rem;
    }

    .prize-pool-badge svg {
      width: 0.875rem;
      height: 0.875rem;
    }
  }

  @media (max-width: 640px) {
    .cup-header {
      padding: 1rem 1.25rem;
      gap: 0.75rem;
    }

    .cup-header-title {
      font-size: 1.125rem;
    }

    .cup-header-badges {
      gap: 0.5rem;
    }

    .cup-badge {
      padding: 0.375rem 0.75rem;
      font-size: 0.75rem;
    }

    .prize-pool-badge svg {
      width: 0.875rem;
      height: 0.875rem;
    }
  }
</style>
