<script lang="ts">
  import { activityStream } from '$lib/stores/activity-stream';
  import MitosisRenderer from '$lib/mitosis/renderer.svelte';
  import { callMCPTool } from '$lib/voice/core-tools';
  import { onMount } from 'svelte';

  // Reactive state that syncs with the store
  let activities = $state<Array<{
    id: string;
    timestamp: string;
    vibeId: string;
    toolName: string;
    result: any;
    ui?: any;
  }>>([]);

  // Subscribe to activity stream on mount
  onMount(() => {
    const unsubscribe = activityStream.subscribe((items) => {
      activities = items;
    });
    return unsubscribe;
  });

  // Handle MCP tool calls from UI interactions
  // Note: vibeId is extracted from the activity context
  async function handleMCPToolCall(tool: string, params?: Record<string, any>) {
    try {
      // Extract vibeId from current activity context or use default
      // For MVP, we'll use 'todos' as default since that's our only vibe
      const vibeId = 'todos'; // TODO: Extract from activity context when we have multiple vibes
      
      const result = await callMCPTool(vibeId, tool, params);
      
      // Add to activity stream
      activityStream.update((items) => [
        ...items,
        {
          id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date().toISOString(),
          vibeId,
          toolName: tool,
          result: result.result,
          ui: result.ui
        }
      ]);
    } catch (error: any) {
      console.error('[Activity Stream] MCP tool call failed:', error);
    }
  }

  function formatTimestamp(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleTimeString();
  }
</script>

<div class="activity-stream-container">
  <div class="activity-stream-header">
    <h1>Your Activity</h1>
    {#if activities.length > 0}
      <button class="clear-btn" onclick={() => activityStream.set([])}>
        Clear
      </button>
    {/if}
  </div>

  {#if activities.length === 0}
    <div class="empty-state">
      <p>No activity yet. Try saying "show me my todos" or "create a new todo"!</p>
    </div>
  {:else}
    <div class="activity-items">
      {#each activities as activity (activity.id)}
        <div class="activity-item">
          <div class="activity-header">
            <span class="vibe-badge">{activity.vibeId}</span>
            <span class="tool-name">{activity.toolName}</span>
            <span class="timestamp">{formatTimestamp(activity.timestamp)}</span>
          </div>
          <div class="activity-content">
            {#if activity.ui}
              <MitosisRenderer 
                config={activity.ui} 
                onMCPToolCall={(tool, params) => handleMCPToolCall(tool, params)}
                useSandbox={true}
              />
            {:else}
              <pre class="activity-result">{JSON.stringify(activity.result, null, 2)}</pre>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .activity-stream-container {
    min-height: 100vh;
    padding: 2rem;
    max-width: 1200px;
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
    padding: 0.5rem 1rem;
    background: var(--color-accent-500);
    color: white;
    border: none;
    border-radius: 0.5rem;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 600;
  }

  .clear-btn:hover {
    background: var(--color-accent-600);
  }

  .empty-state {
    text-align: center;
    padding: 4rem 2rem;
    color: var(--color-primary-600);
    font-size: 1.125rem;
  }

  .activity-items {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .activity-item {
    background: white;
    border-radius: 0.75rem;
    padding: 1.5rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    border: 1px solid #e5e5e5;
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
    background: var(--color-primary-500);
    color: white;
    padding: 0.25rem 0.75rem;
    border-radius: 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    text-transform: capitalize;
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

  @media (max-width: 768px) {
    .activity-stream-container {
      padding: 1rem;
    }

    .activity-stream-header h1 {
      font-size: 1.5rem;
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
