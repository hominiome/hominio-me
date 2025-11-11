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
  <div class="activity-stream-header">
    <h1>Your Activity</h1>
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

  {#if activities.length === 0}
    <div class="empty-state">
      <p>
        No activity yet. Try saying "show me my todos" or "create a new todo"!
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

<style>
  .activity-stream-container {
    min-height: 100vh;
    padding: 2rem;
    max-width: 1400px;
    margin: 0 auto;
    background: linear-gradient(180deg, #fefdfb 0%, #faf8f5 100%);
  }

  .activity-stream-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
  }

  .activity-stream-header h1 {
    font-size: 2rem;
    font-weight: 700;
    color: var(--color-primary-500);
    margin: 0;
  }

  .clear-btn {
    padding: 0.5rem 1.25rem;
    background: linear-gradient(135deg, #2da6b4 0%, #2399a8 100%);
    color: white;
    border: 2px solid rgba(45, 166, 180, 0.3);
    border-radius: 12px;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 700;
    transition: all 0.3s ease;
    box-shadow: 0 2px 8px rgba(45, 166, 180, 0.25);
  }

  .clear-btn:hover {
    background: linear-gradient(135deg, #2399a8 0%, #1c8a98 100%);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(45, 166, 180, 0.35);
  }

  .empty-state {
    text-align: center;
    padding: 4rem 2rem;
    color: var(--color-primary-600);
    font-size: 1.125rem;
  }

  /* Left sidebar: Compact activity list */
  .activity-sidebar {
    flex-shrink: 0;
    width: 240px;
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
    gap: 0.75rem;
    padding: 0.625rem 0.875rem;
    background: white;
    border: 1px solid rgba(26, 26, 78, 0.08);
    border-radius: 0.75rem;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
    width: 100%;
    position: relative;
  }

  .sidebar-activity-item:hover {
    background: rgba(78, 205, 196, 0.05);
    border-color: rgba(78, 205, 196, 0.2);
    transform: translateX(2px);
  }

  .sidebar-activity-item.selected {
    background: rgba(78, 205, 196, 0.1);
    border-color: var(--color-secondary-500);
    border-left-width: 3px;
    padding-left: calc(0.875rem - 2px);
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

  .sidebar-activity-item:hover .sidebar-activity-dot,
  .sidebar-activity-item.selected .sidebar-activity-dot {
    background: var(--color-secondary-500);
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
    font-size: 0.625rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-secondary-500);
    background: rgba(45, 166, 180, 0.1);
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    width: fit-content;
  }

  .sidebar-action {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-primary-600);
    line-height: 1.2;
  }

  /* Main layout: sidebar + content */
  .activity-main-layout {
    display: flex;
    gap: 2rem;
    align-items: flex-start;
  }

  /* Main content area */
  .activity-main-content {
    flex: 1;
    min-width: 0;
  }

  .activity-item {
    background: white;
    border-radius: 20px;
    padding: 1.5rem;
    box-shadow: 0 2px 8px rgba(26, 26, 78, 0.08);
    border: 2px solid rgba(26, 26, 78, 0.08);
    transition: all 0.3s ease;
  }

  .activity-item.expanded {
    border: 2px solid rgba(78, 205, 196, 0.3);
    box-shadow: 0 8px 24px rgba(78, 205, 196, 0.15);
    transform: translateY(-2px);
  }

  .activity-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid #e5e5e5;
  }

  .vibe-badge {
    background: linear-gradient(135deg, #2da6b4 0%, #2399a8 100%);
    color: white;
    padding: 0.375rem 0.875rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    box-shadow: 0 2px 8px rgba(45, 166, 180, 0.25);
  }

  .tool-name {
    color: var(--color-secondary-500);
    font-weight: 600;
    font-size: 0.875rem;
    text-transform: capitalize;
  }

  .timestamp {
    margin-left: auto;
    color: #666;
    font-size: 0.75rem;
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
    color: rgba(8, 27, 71, 0.6);
    font-size: 1.125rem;
    background: white;
    border-radius: 20px;
    border: 2px solid rgba(26, 26, 78, 0.08);
    box-shadow: 0 2px 8px rgba(26, 26, 78, 0.08);
  }

  @media (max-width: 768px) {
    .activity-stream-container {
      padding: 1rem;
    }

    .activity-stream-header h1 {
      font-size: 1.5rem;
    }

    .collapsed-bars-container {
      max-width: 100%;
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

    .activity-header {
      flex-wrap: wrap;
    }

    .timestamp {
      margin-left: 0;
      width: 100%;
    }
  }
</style>
