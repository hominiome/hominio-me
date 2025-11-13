<script lang="ts">
  import type { MenuItem } from './types';

  export let items: MenuItem[] = [];
  export let category: string | null = null;
</script>

<div class="menu-list-container">
  {#if category}
    <h2 class="text-2xl font-bold text-[var(--color-secondary-700)] mb-6">
      Menü - {category}
    </h2>
  {:else}
    <h2 class="text-2xl font-bold text-[var(--color-secondary-700)] mb-6">
      Unser Menü
    </h2>
  {/if}

  <div class="menu-items-grid">
    {#each items as item (item.id)}
      <div class="menu-item-card">
        <div class="menu-item-header">
          <div class="menu-item-title-section">
            <p class="menu-item-name">{item.name}</p>
            <p class="menu-item-description">{item.description}</p>
          </div>
          <div class="menu-item-pricing">
            <div class="menu-item-price">
              <span>{item.priceFormatted}</span>
              <span class="menu-item-unit">{item.unitFormatted}</span>
            </div>
          </div>
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .menu-list-container {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .menu-items-grid {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .menu-item-card {
    display: flex;
    align-items: stretch;
    background: white;
    border: 1px solid rgba(45, 166, 180, 0.25);
    border-radius: 16px;
    box-shadow: 0 1px 4px rgba(45, 166, 180, 0.08);
    overflow: hidden;
    min-height: 72px;
  }

  .menu-item-header {
    display: flex;
    align-items: stretch;
    width: 100%;
  }

  .menu-item-title-section {
    flex: 1;
    min-width: 0;
    padding: 0.75rem 1.25rem;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 0.2rem;
  }

  .menu-item-name {
    display: block;
    margin: 0;
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--color-brand-navy-700);
    line-height: 1.25;
    letter-spacing: -0.01em;
  }

  .menu-item-description {
    display: block;
    margin: 0;
    font-size: 0.8125rem;
    font-weight: 400;
    color: #64748b;
    line-height: 1.35;
  }

  .menu-item-pricing {
    display: flex;
    align-items: stretch;
    justify-content: stretch;
    background: var(--color-secondary-200);
    border-left: 1px solid rgba(45, 166, 180, 0.4);
    min-width: 96px;
  }

  .menu-item-price {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 1.25rem;
    color: var(--color-brand-navy-800);
    padding: 0 1.1rem;
    letter-spacing: -0.015em;
  }

  .menu-item-unit {
    font-size: 0.6rem;
    font-weight: 600;
    color: var(--color-secondary-700);
    text-transform: lowercase;
  }
</style>

