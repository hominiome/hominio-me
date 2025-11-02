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
      <!-- Amount added (above, smaller) -->
      {#if amountAdded > 0}
        <div class="prize-pool-increase">
          <span class="prize-pool-plus">+</span>
          <span class="prize-pool-amount added">{formatAmount(amountAdded)}</span>
        </div>
      {/if}
      
      <!-- Total pool size (center, largest) -->
      <div class="prize-pool-total">
        <span class="prize-pool-amount current">{formatAmount(currentPool)}</span>
      </div>
      
      <!-- Label (below) -->
      <div class="prize-pool-label-wrapper">
        <span class="prize-pool-label">Prize Pool</span>
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
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    color: #1a1a4e;
  }

  .prize-pool-increase {
    display: flex;
    align-items: baseline;
    gap: 0.25rem;
    opacity: 0.9;
  }

  .prize-pool-total {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .prize-pool-label-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .prize-pool-label {
    font-size: 0.875rem;
    font-weight: 600;
    opacity: 0.7;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .prize-pool-amount {
    line-height: 1;
    font-weight: 900;
    white-space: nowrap;
    color: #1a1a4e;
  }

  .prize-pool-amount.current {
    font-size: 3rem;
  }

  .prize-pool-amount.added {
    font-size: 1.5rem;
  }

  .prize-pool-plus {
    font-size: 1.5rem;
    line-height: 1;
    font-weight: 900;
    color: #1a1a4e;
  }

  @media (max-width: 768px) {
    .prize-pool-content {
      gap: 0.375rem;
    }

    .prize-pool-label {
      font-size: 0.75rem;
    }

    .prize-pool-amount.current {
      font-size: 2.5rem;
    }

    .prize-pool-amount.added {
      font-size: 1.25rem;
    }

    .prize-pool-plus {
      font-size: 1.25rem;
    }
  }
</style>

