<script lang="ts">
  import { formatPrizePool } from "$lib/prizePoolUtils.js";
  import { onMount } from "svelte";

  let { purchaseId } = $props<{
    purchaseId: string; // Identity purchase ID
  }>();

  let currentPool = $state<number>(0);
  let amountAdded = $state<number>(0);
  let loading = $state(true);

  onMount(async () => {
    try {
      // Fetch purchase data
      const response = await fetch(`/alpha/api/purchase-data/${purchaseId}`);
      if (response.ok) {
        const data = await response.json();
        currentPool = data.currentPool;
        amountAdded = data.amountAdded;
      }
    } catch (error) {
      console.error("Failed to fetch prize pool data:", error);
    } finally {
      loading = false;
    }
  });

  const formatAmount = (cents: number) => {
    return formatPrizePool(cents);
  };
</script>

{#if !loading && currentPool > 0}
  <div class="prize-pool-display">
    <div class="prize-pool-content">
      <div class="prize-pool-section">
        <span class="prize-pool-label">Prize Pool:</span>
        <span class="prize-pool-amount current">{formatAmount(currentPool)}</span>
      </div>
      <div class="prize-pool-section increase">
        <span class="prize-pool-plus">+</span>
        <span class="prize-pool-amount added">{formatAmount(amountAdded)}</span>
      </div>
    </div>
  </div>
{/if}

<style>
  .prize-pool-display {
    background: linear-gradient(
      135deg,
      rgba(255, 215, 0, 0.95) 0%,
      rgba(255, 237, 78, 0.95) 100%
    );
    border-radius: 16px;
    padding: 1.5rem;
    width: 100%;
  }

  .prize-pool-content {
    display: flex;
    flex-direction: row;
    align-items: baseline;
    justify-content: center;
    gap: 1.5rem;
    color: #1a1a4e;
    flex-wrap: wrap;
  }

  .prize-pool-section {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
  }

  .prize-pool-label {
    font-size: 0.875rem;
    font-weight: 600;
    opacity: 0.8;
    white-space: nowrap;
  }

  .prize-pool-amount {
    font-size: 2rem;
    line-height: 1;
    font-weight: 900;
    white-space: nowrap;
    color: #1a1a4e;
  }

  .prize-pool-amount.current {
    font-size: 1.75rem;
  }

  .prize-pool-amount.added {
    font-size: 2.5rem;
  }

  .prize-pool-plus {
    font-size: 2rem;
    line-height: 1;
    font-weight: 900;
    color: #1a1a4e;
  }

  @media (max-width: 768px) {
    .prize-pool-content {
      gap: 1rem;
    }

    .prize-pool-section {
      gap: 0.375rem;
    }

    .prize-pool-label {
      font-size: 0.75rem;
    }

    .prize-pool-amount {
      font-size: 1.5rem;
    }

    .prize-pool-amount.current {
      font-size: 1.25rem;
    }

    .prize-pool-amount.added {
      font-size: 1.875rem;
    }

    .prize-pool-plus {
      font-size: 1.5rem;
    }
  }
</style>

