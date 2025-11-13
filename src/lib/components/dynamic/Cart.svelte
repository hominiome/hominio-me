<script lang="ts">
  import type { CartItem } from './types';

  export let items: CartItem[] = [];
</script>

<div class="cart-container">
  <div class="cart-header">
    <h3 class="cart-title">WARENKORB</h3>
  </div>

  <div class="cart-items-list">
    {#each items as item (item.id)}
      <div class="cart-item">
        <div class="cart-item-name">
          <span>{item.quantity}x {item.name}</span>
          {#if item.timeSlot}
            <span class="cart-item-time-slot">{item.timeSlot}</span>
          {/if}
        </div>
        <div class="cart-item-price">{item.priceFormatted}</div>
      </div>
    {/each}
  </div>

  <div class="cart-total">
    <span class="cart-total-label">GESAMT:</span>
    <span class="cart-total-amount">
      €{items.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2)}
    </span>
  </div>
</div>

<style>
  .cart-container {
    width: 100%;
  }

  .cart-header {
    margin-bottom: 0.75rem;
    padding-bottom: 0.75rem;
    border-bottom: 2px solid rgba(45, 166, 180, 0.3);
  }

  .cart-title {
    font-size: 1rem;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.95);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .cart-items-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .cart-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .cart-item:last-child {
    border-bottom: none;
  }

  .cart-item-name {
    font-size: 0.75rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .cart-item-time-slot {
    font-size: 0.625rem;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.7);
    font-style: italic;
  }

  .cart-item-price {
    font-size: 0.75rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.95);
    margin-left: 1rem;
  }

  .cart-total {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 0.75rem;
    margin-top: 0.75rem;
    border-top: 3px solid var(--color-secondary-400);
  }

  .cart-total-label {
    font-size: 0.75rem;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.95);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .cart-total-amount {
    font-size: 0.875rem;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.95);
  }
</style>

