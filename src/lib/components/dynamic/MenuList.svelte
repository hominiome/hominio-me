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
    gap: 1rem;
  }

  .menu-item-card {
    background: white;
    border: 1px solid rgba(45, 166, 180, 0.25);
    border-radius: 16px;
    padding: 1.25rem 1.5rem;
    box-shadow: 0 1px 6px rgba(45, 166, 180, 0.08);
  }

  .menu-item-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    width: 100%;
  }

  .menu-item-title-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex: 1;
    min-width: 0;
  }

  .menu-item-name {
    display: block;
    margin: 0;
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-brand-navy-700);
    line-height: 1.3;
    letter-spacing: -0.01em;
  }

  .menu-item-description {
    display: block;
    margin: 0;
    font-size: 0.875rem;
    font-weight: 400;
    color: #64748b;
    line-height: 1.5;
    margin-top: 0.25rem;
  }

  .menu-item-pricing {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.5rem;
    flex-shrink: 0;
    margin-right: -1.5rem;
  }

  .menu-item-price {
    font-weight: 800;
    color: var(--color-brand-navy-800);
    background: var(--color-secondary-200);
    border: 2px solid var(--color-secondary-400);
    border-left: none;
    font-size: 1.5rem;
    text-align: center;
    min-width: fit-content;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.125rem;
    letter-spacing: -0.02em;
    padding: 0.625rem 1rem;
    padding-right: 1.5rem;
    border-radius: 0 12px 12px 0;
    box-shadow: 0 2px 8px rgba(45, 166, 180, 0.15);
  }

  .menu-item-unit {
    font-size: 0.625rem;
    font-weight: 600;
    color: var(--color-secondary-700);
    text-transform: lowercase;
  }
</style>

