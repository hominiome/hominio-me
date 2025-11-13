<script lang="ts">
  import type { TaxiService } from './types';

  export let services: TaxiService[] = [];
</script>

<div class="flex flex-col gap-6">
  <h2 class="text-2xl font-bold text-[var(--color-secondary-700)] mb-6">
    Taxi Services
  </h2>

  <div class="flex flex-col gap-3">
    {#each services as service (service.id)}
      <div class="flex items-stretch bg-white border border-[rgba(45,166,180,0.25)] rounded-2xl shadow-[0_1px_4px_rgba(45,166,180,0.08)] overflow-hidden min-h-[72px]">
        <div class="flex items-stretch w-full">
          <div class="flex-1 min-w-0 px-5 py-3 flex flex-col justify-center gap-0.5">
            <p class="block m-0 text-lg font-bold text-[var(--color-brand-navy-700)] leading-tight tracking-[-0.01em]">{service.name}</p>
            <p class="block m-0 text-[0.8125rem] font-normal text-slate-500 leading-[1.35]">{service.description}</p>
            {#if service.capacity}
              <p class="block mt-1 mb-0 text-xs font-medium text-[var(--color-secondary-600)] leading-[1.3]">👥 Bis zu {service.capacity} Personen</p>
            {/if}
          </div>
          <div class="flex items-stretch justify-stretch bg-[var(--color-secondary-200)] border-l border-[rgba(45,166,180,0.4)] min-w-[120px]">
            <div class="flex-1 flex flex-col items-center justify-center px-4 gap-0.5">
              <span class="font-extrabold text-xl text-[var(--color-brand-navy-800)] tracking-[-0.015em]">{service.basePriceFormatted}</span>
              <span class="text-[0.6rem] font-semibold text-[var(--color-secondary-700)] lowercase">{service.unit}</span>
              <span class="text-[0.65rem] font-medium text-[var(--color-secondary-600)]">+ {service.pricePerKmFormatted}/km</span>
            </div>
          </div>
        </div>
      </div>
    {/each}
  </div>
</div>

