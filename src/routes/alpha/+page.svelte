<script lang="ts">
  import { activityStream } from "$lib/stores/activity-stream";
  import MitosisRenderer from "$lib/mitosis/renderer.svelte";
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

  // Track which item is currently expanded/selected
  let selectedActivityId = $state<string | null>(null);
  let previousActivitiesLength = $state(0);

  // Subscribe to activity stream on mount
  onMount(() => {
    const unsubscribe = activityStream.subscribe((items) => {
      const wasNewItemAdded = items.length > previousActivitiesLength;
      activities = items;
      
      // Always auto-select the latest item when a new one is added
      if (items.length > 0) {
        const latestId = items[items.length - 1].id;
        
        // If a new item was added, always select the latest one
        if (wasNewItemAdded) {
          selectedActivityId = latestId;
        }
        // Otherwise, only select if nothing is selected or selected item no longer exists
        else if (
          selectedActivityId === null ||
          !items.find((a) => a.id === selectedActivityId)
        ) {
          selectedActivityId = latestId;
        }
      }
      
      previousActivitiesLength = items.length;
    });
    return unsubscribe;
  });

  // Get the currently selected activity
  const selectedActivity = $derived(
    activities.find((a) => a.id === selectedActivityId) || null
  );

  // Get all activities for left sidebar (show all, newest first)
  const sidebarActivities = $derived(() => {
    return [...activities].reverse(); // All activities, newest first
  });

  // Handle selecting an activity
  function selectActivity(id: string) {
    selectedActivityId = id;
  }

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

  function getActivityTitle(activity: (typeof activities)[0]): string {
    return `${activity.vibeId} • ${activity.toolName}`;
  }

  function formatActionName(toolName: string): string {
    // Convert snake_case to readable format
    return toolName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
</script>

<div class="activity-stream-container">
  <!-- Full-width header -->
  <div class="activity-stream-header">
    <div class="activity-stream-header-content">
      <h1>How can I help you?</h1>
      {#if activities.length > 0}
        <button
          class="clear-btn"
          onclick={() => {
            activityStream.set([]);
            selectedActivityId = null;
            previousActivitiesLength = 0;
          }}
        >
          Clear
        </button>
      {/if}
    </div>
  </div>

  <!-- Override layout padding for full-width background -->
  <div class="activity-stream-content activity-stream-content-full-width">
    {#if activities.length === 0}
      <div class="empty-state">
        <p>
          <strong>Ich bin Hominio, dein persönlicher Concierge.</strong><br>
          Drücke einfach den Mikrofon-Button und beginne mit mir zu sprechen.<br><br>
          <strong>Beispiele:</strong><br>
          • "Zeig mir das Menü"<br>
          • "Was für Getränke habt ihr?"<br>
          • "Ich möchte ein Wiener Schnitzel bestellen"<br>
          • "Zeig mir die Nachspeisen"<br>
          • "Bestelle mir zwei Cola und ein Tiramisu"<br>
          • "Zeig mir die SPA Services"<br>
          • "Was für Massagen habt ihr?"<br>
          • "Ich möchte eine Sauna Session buchen"<br>
          • "Buch mir eine Entspannungsmassage um 10 Uhr"<br>
          • "Zeig mir die Taxi Services"<br>
          • "Ich brauche ein Taxi um 14:30 Uhr"<br>
          • "Zeig mir Room Service"<br>
          • "Ich möchte ein Frühstück aufs Zimmer"
        </p>
      </div>
    {:else}
    <div class="activity-main-layout">
      <!-- Left sidebar: Compact activity list -->
      <aside class="activity-sidebar">
        <div class="sidebar-activities">
          {#each sidebarActivities() as activity, index (activity.id)}
            <button
              class="sidebar-activity-item"
              class:selected={activity.id === selectedActivityId}
              onclick={() => selectActivity(activity.id)}
              aria-label={`Activity ${index + 1}: ${getActivityTitle(activity)}`}
            >
              <div class="sidebar-activity-dot"></div>
              <div class="sidebar-activity-content">
                <div class="sidebar-schema">{activity.vibeId}</div>
                <div class="sidebar-action">{formatActionName(activity.toolName)}</div>
              </div>
            </button>
          {/each}
        </div>
      </aside>

      <!-- Main content area: Only the selected activity -->
      <main class="activity-main-content">
        {#if selectedActivity}
          <div class="activity-item expanded">
            <div class="activity-header">
              <span class="vibe-badge">{selectedActivity.vibeId}</span>
              <span class="tool-name">{selectedActivity.toolName}</span>
              <span class="timestamp"
                >{formatTimestamp(selectedActivity.timestamp)}</span
              >
            </div>
            <div class="activity-content">
              {#if selectedActivity.ui}
                <MitosisRenderer
                  config={selectedActivity.ui}
                  onMCPToolCall={(tool, params) =>
                    handleMCPToolCall(tool, params)}
                />
              {:else}
                <pre class="activity-result">{JSON.stringify(
                    selectedActivity.result,
                    null,
                    2
                  )}</pre>
              {/if}
            </div>
          </div>
        {:else}
          <div class="empty-selection">
            <p>Select an activity from the history</p>
          </div>
        {/if}
      </main>
    </div>
    {/if}
  </div>
</div>

<style>
  .activity-stream-container {
    min-height: 100vh;
    padding: 0;
    max-width: none;
    margin: 0;
    position: relative;
    background: #f0f2f5; /* Clean light gray background like DIONYS */
  }

  /* Inner content wrapper with padding - max-w-6xl */
  .activity-stream-content {
    max-width: 72rem; /* max-w-6xl */
    margin: 0 auto;
    padding: 1.5rem;
    padding-top: 2rem; /* Add top padding since header is now outside */
    position: relative;
    z-index: 1;
    width: 100%;
    box-sizing: border-box;
  }

  /* Override layout padding for full-width background */
  .activity-stream-content-full-width {
    padding-left: 1.5rem !important;
    padding-right: 1.5rem !important;
    width: 100% !important;
  }

  .activity-stream-header {
    width: 100%;
    /* DIONYS FlowStateMachine header style - dark blue background */
    background: var(--color-primary-500); /* #081b47 / #000957 equivalent */
    border-bottom: 1px solid #e2e8f0;
    position: relative;
    z-index: 1;
    margin: 0;
    padding: 0;
  }

  .activity-stream-header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    max-width: 72rem; /* max-w-6xl */
    margin: 0 auto;
    padding: 0.75rem 2rem;
    width: 100%;
    box-sizing: border-box;
  }

  .activity-stream-header h1 {
    font-size: 1.5rem;
    font-weight: 700;
    color: white;
    margin: 0;
    line-height: 1.3;
    letter-spacing: 0.05em;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  @media (min-width: 768px) {
    .activity-stream-header h1 {
      font-size: 1.75rem;
    }
  }

  @media (min-width: 1024px) {
    .activity-stream-header h1 {
      font-size: 2rem;
    }
  }

  .clear-btn {
    padding: 0.5rem 1rem;
    /* DIONYS FlowStateMachine clear-btn style */
    background: transparent;
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .clear-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.5);
    transform: translateY(-1px);
  }

  .clear-btn:active {
    transform: translateY(0);
  }

  .empty-state {
    text-align: center;
    padding: 4rem 2rem;
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
  }

  .empty-state p {
    /* DIONYS content-area style */
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    padding: 2rem 3rem;
    display: inline-block;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    color: #6b7280; /* DIONYS body text color */
    font-size: 1rem;
    font-weight: 400;
    line-height: 1.8;
    margin: 0 auto;
    position: relative;
    max-width: 72rem; /* max-w-6xl */
    text-align: left;
  }

  .empty-state p strong {
    color: #1f2937; /* DIONYS dark text */
    font-weight: 600;
  }

  @media (min-width: 768px) {
    .empty-state p {
      font-size: 1.125rem;
    }
  }

  /* Left sidebar: Compact activity list */
  .activity-sidebar {
    flex-shrink: 0;
    width: 140px; /* Kompakter: von 240px auf 140px */
    position: sticky;
    top: 2rem;
    align-self: flex-start;
    max-height: calc(100vh - 4rem);
    overflow-y: auto;
  }

  .sidebar-activities {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    position: relative;
  }

  .sidebar-activity-item {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem; /* Kompakter: von 0.75rem auf 0.5rem */
    padding: 0.375rem 0.5rem; /* Kompakter: von 0.5rem 0.75rem */
    /* DIONYS VersionHistory version-item style */
    background: white;
    border: 2px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
    width: 100%;
    position: relative;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  }

  .sidebar-activity-item:hover {
    background: white;
    border-color: var(--color-accent-500); /* Yellow accent */
    transform: translateX(-2px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  }

  .sidebar-activity-item.selected {
    /* DIONYS VersionHistory active style - but with yellow accent */
    background: linear-gradient(135deg, var(--color-accent-500) 0%, var(--color-accent-600) 100%);
    border-color: var(--color-accent-500);
    box-shadow: 0 4px 12px rgba(244, 208, 63, 0.2);
  }

  .sidebar-activity-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgba(26, 26, 78, 0.2);
    margin-top: 0.375rem;
    flex-shrink: 0;
    transition: all 0.2s ease;
  }

  .sidebar-activity-item:hover .sidebar-activity-dot {
    background: var(--color-accent-500); /* Yellow accent */
    transform: scale(1.2);
  }

  .sidebar-activity-item.selected .sidebar-activity-dot {
    background: white;
    transform: scale(1.2);
  }

  .sidebar-activity-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .sidebar-schema {
    font-size: 0.625rem; /* Kompakter: von 0.75rem auf 0.625rem */
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #1f2937; /* DIONYS dark text */
    line-height: 1.2; /* Kompakter: von 1.4 auf 1.2 */
  }

  .sidebar-activity-item.selected .sidebar-schema {
    color: white;
  }

  .sidebar-action {
    font-size: 0.625rem; /* Kompakter: von 0.75rem auf 0.625rem */
    font-weight: 600;
    color: #1f2937; /* DIONYS dark text */
    line-height: 1.2; /* Kompakter: von 1.3 auf 1.2 */
    margin-top: 0.0625rem; /* Kompakter: von 0.125rem auf 0.0625rem */
  }

  .sidebar-activity-item.selected .sidebar-action {
    color: white;
  }

  /* Main layout: sidebar + content */
  .activity-main-layout {
    display: flex;
    gap: 1rem; /* Kompakter: von 2rem auf 1rem */
    align-items: flex-start;
    position: relative;
    z-index: 1;
  }

  /* Main content area */
  .activity-main-content {
    flex: 1;
    min-width: 0;
  }

  .activity-item {
    /* DIONYS content-area style - exact match */
    background: white;
    border-radius: 16px;
    padding: 2rem;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    border: 1px solid #e2e8f0;
    position: relative;
    max-width: 72rem; /* max-w-6xl */
    margin-left: auto;
    margin-right: auto;
    transition: all 0.2s ease;
  }

  .activity-item.expanded {
    background: white;
    border-color: var(--color-accent-500); /* Yellow accent */
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  }

  .activity-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #e2e8f0;
  }

  .vibe-badge {
    /* DIONYS badge style with yellow accent */
    background: var(--color-accent-500); /* Yellow accent */
    color: var(--color-accent-900); /* Dark yellow for contrast */
    padding: 0.125rem 0.375rem;
    border-radius: 10px;
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    min-width: 18px;
    text-align: center;
  }

  .tool-name {
    color: #1f2937; /* DIONYS dark text */
    font-weight: 600;
    font-size: 0.875rem;
    text-transform: capitalize;
  }

  .timestamp {
    margin-left: auto;
    color: #9ca3af; /* DIONYS gray text */
    font-size: 0.625rem;
  }

  .activity-content {
    margin-top: 1rem;
  }

  .activity-result {
    background: #f5f5f5;
    padding: 1rem;
    border-radius: 0.5rem;
    overflow-x: auto;
    font-size: 0.875rem;
    margin: 0;
  }

  .empty-selection {
    text-align: center;
    padding: 4rem 2rem;
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
  }

  .empty-selection p {
    /* DIONYS content-area style */
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    padding: 2rem 3rem;
    display: inline-block;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    color: #6b7280; /* DIONYS body text color */
    font-size: 1rem;
    font-weight: 400;
    line-height: 1.5;
    margin: 0 auto;
    position: relative;
    max-width: 72rem; /* max-w-6xl */
    text-align: center;
  }

  @media (min-width: 768px) {
    .empty-state p,
    .empty-selection p {
      font-size: 1.125rem;
    }
  }

  @media (max-width: 768px) {
    .activity-stream-content {
      padding: 1rem;
    }

    .activity-stream-header {
      padding: 0.5rem 1rem;
    }

    .activity-stream-header h1 {
      font-size: 1.25rem;
    }

    .activity-main-layout {
      flex-direction: column;
      gap: 1rem;
    }

    .activity-sidebar {
      width: 100%;
      position: static;
      max-height: none;
    }

    .activity-item {
      padding: 1rem;
    }

    .activity-header {
      flex-wrap: wrap;
    }

    .timestamp {
      margin-left: 0;
      width: 100%;
    }
  }
</style>
