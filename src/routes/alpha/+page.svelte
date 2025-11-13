<script lang="ts">
  import { activityStream } from "$lib/stores/activity-stream";
  import ComponentRenderer from "$lib/components/dynamic/ComponentRenderer.svelte";
  import { executeAction } from "$lib/voice/core-tools";
  import { onMount } from "svelte";

  // Reactive state that syncs with the store
  let activities = $state<
    Array<{
      id: string;
      timestamp: string;
      vibeId: string;
      toolName: string;
      result: any;
      ui?: any;
    }>
  >([]);

  // Subscribe to activity stream on mount
  onMount(() => {
    const unsubscribe = activityStream.subscribe((items) => {
      activities = items;
    });
    return unsubscribe;
  });

  // Get the latest activity
  const latestActivity = $derived(
    activities.length > 0 ? activities[activities.length - 1] : null
  );

  // Handle action calls from UI interactions
  async function handleMCPToolCall(action: string, params?: Record<string, any>) {
    try {
      const result = await executeAction(action, params || {});

      // Add to activity stream
      activityStream.update((items) => [
        ...items,
        {
          id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date().toISOString(),
          vibeId: "todos", // Default vibe for now
          toolName: action,
          result: result.result,
          ui: result.ui,
        },
      ]);
    } catch (error: any) {
      console.error("[Activity Stream] Action execution failed:", error);
    }
  }

  function formatTimestamp(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleTimeString();
  }

  // Convert tool names to human-readable titles
  function getHumanReadableTitle(vibeId: string, toolName: string): string {
    const titleMap: Record<string, string> = {
      // Menu tools
      'list_menu': 'Speisekarte',
      'list_beverages': 'Getränkekarte',
      'list_desserts': 'Dessertkarte',
      
      // SPA tools
      'list_spa_services': 'SPA Services',
      'list_massages': 'Massage Angebote',
      'list_beauty': 'Beauty Services',
      
      // Taxi tools
      'list_taxi': 'Taxi Services',
      'book_taxi': 'Taxi Buchung',
      
      // Room service
      'list_room_service': 'Zimmerservice',
      'order_room_service': 'Bestellung',
      
      // Cart
      'view_cart': 'Warenkorb',
      'checkout': 'Bestellung abschließen',
      
      // Todos
      'list_todos': 'Aufgaben',
      'create_todo': 'Neue Aufgabe',
    };
    
    return titleMap[toolName] || 'Übersicht';
  }
</script>

<div class="min-h-screen p-0 m-0 bg-[#f0f2f5]">
  <!-- Inner content wrapper -->
  <div class="max-w-6xl mx-auto px-[6px] md:px-6 py-2 md:py-8 w-full relative z-[1]">
    {#if activities.length === 0}
      <!-- Empty State -->
      <div class="p-2 md:p-8 flex justify-center items-start w-full min-h-[calc(100vh-200px)]">
        <div class="bg-white border border-[rgba(8,27,71,0.12)] rounded-3xl p-4 md:p-10 lg:p-12 shadow-[0_4px_20px_rgba(8,27,71,0.08),0_1px_4px_rgba(8,27,71,0.04)] max-w-3xl w-full">
          <div class="mb-10 text-center">
            <h2 class="text-3xl md:text-4xl lg:text-5xl font-semibold text-gray-800 mb-4 leading-tight">
              Ich bin Hominio, dein persönlicher Concierge.
            </h2>
            <p class="text-base md:text-lg text-gray-600 leading-relaxed">
              Drücke einfach den <strong class="text-gray-800 font-semibold">Mikrofon-Button</strong> und beginne mit mir zu sprechen.
            </p>
          </div>
          
          <div class="mt-8">
            <h3 class="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-5">
              Beispiele
            </h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
              <div class="p-4 sm:p-5 bg-[var(--color-brand-cream-50)] border border-[rgba(8,27,71,0.1)] rounded-2xl transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] cursor-default shadow-[0_1px_3px_rgba(8,27,71,0.04)] hover:bg-white hover:border-[rgba(45,166,180,0.3)] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(45,166,180,0.12),0_2px_8px_rgba(45,166,180,0.08)]">
                <p class="text-[0.9375rem] sm:text-base text-gray-700 m-0 leading-relaxed">
                  Zeig mir das Menü
                </p>
              </div>
              <div class="p-4 sm:p-5 bg-[var(--color-brand-cream-50)] border border-[rgba(8,27,71,0.1)] rounded-2xl transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] cursor-default shadow-[0_1px_3px_rgba(8,27,71,0.04)] hover:bg-white hover:border-[rgba(45,166,180,0.3)] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(45,166,180,0.12),0_2px_8px_rgba(45,166,180,0.08)]">
                <p class="text-[0.9375rem] sm:text-base text-gray-700 m-0 leading-relaxed">
                  Was für Getränke habt ihr?
                </p>
              </div>
              <div class="p-4 sm:p-5 bg-[var(--color-brand-cream-50)] border border-[rgba(8,27,71,0.1)] rounded-2xl transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] cursor-default shadow-[0_1px_3px_rgba(8,27,71,0.04)] hover:bg-white hover:border-[rgba(45,166,180,0.3)] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(45,166,180,0.12),0_2px_8px_rgba(45,166,180,0.08)]">
                <p class="text-[0.9375rem] sm:text-base text-gray-700 m-0 leading-relaxed">
                  Ich möchte ein Wiener Schnitzel bestellen
                </p>
              </div>
              <div class="p-4 sm:p-5 bg-[var(--color-brand-cream-50)] border border-[rgba(8,27,71,0.1)] rounded-2xl transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] cursor-default shadow-[0_1px_3px_rgba(8,27,71,0.04)] hover:bg-white hover:border-[rgba(45,166,180,0.3)] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(45,166,180,0.12),0_2px_8px_rgba(45,166,180,0.08)]">
                <p class="text-[0.9375rem] sm:text-base text-gray-700 m-0 leading-relaxed">
                  Zeig mir die SPA Services
                </p>
              </div>
              <div class="p-4 sm:p-5 bg-[var(--color-brand-cream-50)] border border-[rgba(8,27,71,0.1)] rounded-2xl transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] cursor-default shadow-[0_1px_3px_rgba(8,27,71,0.04)] hover:bg-white hover:border-[rgba(45,166,180,0.3)] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(45,166,180,0.12),0_2px_8px_rgba(45,166,180,0.08)]">
                <p class="text-[0.9375rem] sm:text-base text-gray-700 m-0 leading-relaxed">
                  Was für Massagen habt ihr?
                </p>
              </div>
              <div class="p-4 sm:p-5 bg-[var(--color-brand-cream-50)] border border-[rgba(8,27,71,0.1)] rounded-2xl transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] cursor-default shadow-[0_1px_3px_rgba(8,27,71,0.04)] hover:bg-white hover:border-[rgba(45,166,180,0.3)] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(45,166,180,0.12),0_2px_8px_rgba(45,166,180,0.08)]">
                <p class="text-[0.9375rem] sm:text-base text-gray-700 m-0 leading-relaxed">
                  Bestelle mir zwei Cola und ein Tiramisu
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    {:else if latestActivity}
      <!-- Latest Activity Content -->
      <div class="bg-white rounded-2xl p-6 md:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.08)] border-t-4 border-t-[var(--color-secondary-500)] border-l border-r border-b border-gray-200 max-w-6xl mx-auto transition-all duration-200">
        <!-- Activity Header - Centered Beautiful Title -->
        <div class="flex flex-col items-center justify-center mb-6 pb-4 border-b border-gray-200">
          <h2 class="text-2xl font-bold text-[var(--color-secondary-700)] text-center">
            {getHumanReadableTitle(latestActivity.vibeId, latestActivity.toolName)}
          </h2>
        </div>
        
        <!-- Activity Content -->
        <div class="mt-4">
          {#if latestActivity.ui}
            <ComponentRenderer
              component={latestActivity.ui}
            />
          {:else}
            <pre class="bg-gray-100 p-4 rounded-lg overflow-x-auto text-sm m-0">{JSON.stringify(
                latestActivity.result,
                null,
                2
              )}</pre>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>
