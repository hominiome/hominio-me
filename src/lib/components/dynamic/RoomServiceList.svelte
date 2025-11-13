<script lang="ts">
  import type { MenuItem } from './types';

  export let items: MenuItem[] = [];
  export let category: string | null = null;
</script>

<div class="flex flex-col gap-6">
  {#if category}
    <h2 class="text-2xl font-bold text-[var(--color-secondary-700)] mb-6">
      Room Service - {category}
    </h2>
  {:else}
    <h2 class="text-2xl font-bold text-[var(--color-secondary-700)] mb-6">
      Room Service
    </h2>
  {/if}

  <div class="flex flex-col gap-3">
    {#each items as item (item.id)}
      <div class="flex items-stretch bg-white border border-[rgba(45,166,180,0.25)] rounded-2xl shadow-[0_1px_4px_rgba(45,166,180,0.08)] overflow-hidden min-h-[72px]">
        <div class="flex items-stretch w-full">
          <div class="flex-1 min-w-0 px-5 py-3 flex flex-col justify-center gap-0.5">
            <p class="block m-0 text-lg font-bold text-[var(--color-brand-navy-700)] leading-tight tracking-[-0.01em]">{item.name}</p>
            <p class="block m-0 text-[0.8125rem] font-normal text-slate-500 leading-[1.35]">{item.description}</p>
          </div>
          <div class="flex items-stretch justify-stretch bg-[var(--color-secondary-200)] border-l border-[rgba(45,166,180,0.4)] min-w-[96px]">
            <div class="flex-1 flex flex-col items-center justify-center font-extrabold text-xl text-[var(--color-brand-navy-800)] px-[1.1rem] tracking-[-0.015em]">
              <span>{item.priceFormatted}</span>
              <span class="text-[0.6rem] font-semibold text-[var(--color-secondary-700)] lowercase">{item.unitFormatted}</span>
            </div>
          </div>
        </div>
      </div>
    {/each}
  </div>
</div>

