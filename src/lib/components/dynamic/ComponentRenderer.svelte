<script lang="ts">
  import MenuList from './MenuList.svelte';
  import Cart from './Cart.svelte';
  import type { ComponentResponse } from './types';

  export let component: ComponentResponse | null = null;

  // Component registry
  const components: Record<string, any> = {
    MenuList,
    Cart,
    // Add more components here as we create them
  };
</script>

{#if component && components[component.component]}
  {@const Component = components[component.component]}
  <svelte:component this={Component} {...component.props} />
{:else if component}
  <div class="error">
    Unknown component: {component.component}
  </div>
{/if}

<style>
  .error {
    padding: 1rem;
    background: #fee;
    border: 1px solid #fcc;
    border-radius: 8px;
    color: #c33;
  }
</style>

