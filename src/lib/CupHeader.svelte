<script>
  import { calculatePrizePool, formatPrizePool } from "$lib/prizePoolUtils.js";
  import { getMatchEndDate } from "$lib/dateUtils.js";
  import CountdownTimer from "$lib/CountdownTimer.svelte";
  import Icon from "$lib/design-system/atoms/Icon.svelte";

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

  // Helper function to get status label
  function getStatusLabel(status) {
    switch (status) {
      case "active":
        return "Active";
      case "draft":
        return "Draft";
      case "completed":
        return "Completed";
      default:
        return status;
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
      <div class="cup-header-top-row">
        <h3 class="cup-header-title">{cup.name}</h3>
        <div class="prize-pool-display">
          <div class="prize-pool-icon-circle">
            <Icon name="mdi:currency-usd" size="xl" color="white" />
          </div>
          <div class="prize-pool-text">
            <div class="prize-pool-value">{getPrizePoolForCup(cup.id)}</div>
            <div class="prize-pool-label">Prize Pool</div>
          </div>
        </div>
      </div>
      <div class="cup-header-badges">
        {#if cup.currentRound}
          <span class="cup-badge cup-round-badge">
            <Icon
              name="mdi:tournament"
              size="xs"
              color="var(--color-secondary-600)"
            />
            <span>{getRoundLabel(cup.currentRound)}</span>
          </span>
        {/if}
        {#if roundEndDate}
          <span class="cup-badge cup-countdown-badge">
            <Icon
              name="mdi:clock-outline"
              size="xs"
              color="var(--color-secondary-600)"
            />
            <span>
              <CountdownTimer endDate={roundEndDate} displayFormat="compact" />
            </span>
          </span>
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
    gap: 1rem;
    padding: 1.5rem 2rem;
    background: rgba(45, 166, 180, 0.12);
    border-radius: 16px 16px 0 0;
    border: 2px solid rgba(45, 166, 180, 0.2);
    border-bottom: 3px solid rgba(26, 26, 78, 0.1);
    box-shadow:
      0 4px 16px rgba(8, 27, 71, 0.08),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
    width: 100%;
    max-width: 100%;
  }

  .cup-header-top-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    width: 100%;
  }

  .cup-header-title {
    font-size: 1.5rem;
    font-weight: 800;
    color: #081b47;
    margin: 0;
    letter-spacing: -0.02em;
    text-align: left;
  }

  .prize-pool-display {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .prize-pool-icon-circle {
    width: 3rem;
    height: 3rem;
    border-radius: 50%;
    background: linear-gradient(135deg, #2da6b4 0%, #2399a8 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow:
      0 4px 12px rgba(45, 166, 180, 0.3),
      0 0 0 2px rgba(45, 166, 180, 0.2);
    flex-shrink: 0;
  }

  .prize-pool-text {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .prize-pool-label {
    font-size: 0.625rem;
    font-weight: 700;
    color: #2da6b4;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    line-height: 1;
  }

  .prize-pool-value {
    font-size: 1.5rem;
    font-weight: 900;
    color: #1a5478;
    line-height: 1;
  }

  .cup-header-badges {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .cup-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 600;
    white-space: nowrap;
    border-radius: 9999px;
    background: rgba(45, 166, 180, 0.1);
    border: 1px solid rgba(45, 166, 180, 0.3);
  }

  .cup-round-badge {
    color: #2da6b4;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .cup-countdown-badge {
    color: #2da6b4;
  }

  .cup-countdown-badge :global(*) {
    color: #2da6b4;
    font-size: 0.75rem;
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

    .prize-pool-icon-circle {
      width: 2.5rem;
      height: 2.5rem;
    }

    .prize-pool-label {
      font-size: 0.5625rem;
    }

    .prize-pool-value {
      font-size: 1.25rem;
    }

    .cup-header-badges {
      gap: 0.5rem;
    }

    .cup-badge {
      padding: 0.3125rem 0.625rem;
      font-size: 0.6875rem;
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

    .prize-pool-icon-circle {
      width: 2rem;
      height: 2rem;
    }

    .prize-pool-label {
      font-size: 0.5rem;
    }

    .prize-pool-value {
      font-size: 1rem;
    }

    .cup-header-badges {
      gap: 0.375rem;
    }

    .cup-badge {
      padding: 0.25rem 0.5rem;
      font-size: 0.625rem;
    }
  }
</style>
