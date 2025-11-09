<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import type { MitosisConfig } from './types';

  let { config, onMCPToolCall = null }: {
    config: MitosisConfig | any;
    onMCPToolCall?: ((tool: string, params?: Record<string, any>) => void) | null;
  } = $props();

  let iframeRef: HTMLIFrameElement | null = $state(null);
  let isReady = $state(false);
  let error: string | null = $state(null);

  // Deep clone config to ensure it's serializable for postMessage
  function serializeConfig(cfg: any): any {
    if (!cfg) return null;
    try {
      // Extract plain value if it's a reactive proxy
      let plainValue = cfg;
      if (typeof cfg === 'object' && cfg !== null) {
        // Try to get plain value - JSON.stringify will handle reactive proxies
        plainValue = cfg;
      }
      
      // Use JSON.parse/stringify to ensure deep serialization
      // This will fail if there are non-serializable values (functions, circular refs, etc.)
      const serialized = JSON.parse(JSON.stringify(plainValue));
      console.log('[Sandbox Renderer] Serialized config successfully');
      return serialized;
    } catch (e: any) {
      console.error('[Sandbox Renderer] Failed to serialize config:', e);
      console.error('[Sandbox Renderer] Config that failed:', cfg);
      // Try to identify what's causing the issue
      if (e.message?.includes('circular')) {
        console.error('[Sandbox Renderer] Circular reference detected');
      }
      return null;
    }
  }

  // Handle messages from sandboxed iframe
  function handleMessage(event: MessageEvent) {
    // Security: Validate origin - only accept messages from same origin
    // Note: In iframe, event.origin will be the same as parent window origin
    if (event.origin !== window.location.origin && event.source !== iframeRef?.contentWindow) {
      console.warn('[Sandbox Renderer] Blocked message from unauthorized origin:', event.origin);
      return;
    }

    const { type, payload } = event.data || {};

    if (type === 'sandbox-ready') {
      isReady = true;
      // Send config to sandbox once it's ready
      if (iframeRef?.contentWindow && config) {
        const serializedConfig = serializeConfig(config);
        if (serializedConfig) {
          iframeRef.contentWindow.postMessage(
            { type: 'render', config: serializedConfig },
            window.location.origin
          );
        }
      }
    } else if (type === 'mcp-tool-call') {
      // Forward MCP tool calls to parent handler
      if (onMCPToolCall) {
        onMCPToolCall(payload.tool, payload.params);
      }
    } else if (type === 'error') {
      error = payload.message || 'Unknown error in sandbox';
      console.error('[Sandbox Renderer] Error from sandbox:', payload);
    }
  }

  onMount(() => {
    if (!browser) return;

    // Listen for messages from sandbox
    window.addEventListener('message', handleMessage);

    // Send config when iframe loads
    if (iframeRef) {
      iframeRef.onload = () => {
        // Config will be sent when sandbox reports ready
      };
    }
  });

  onDestroy(() => {
    if (browser) {
      window.removeEventListener('message', handleMessage);
    }
  });

  // Update config when it changes
  $effect(() => {
    if (isReady && iframeRef?.contentWindow && config) {
      const serializedConfig = serializeConfig(config);
      if (serializedConfig) {
        iframeRef.contentWindow.postMessage(
          { type: 'render', config: serializedConfig },
          window.location.origin
        );
      }
    }
  });
</script>

<div class="sandbox-container">
  {#if error}
    <div class="sandbox-error">
      <p>Error rendering component: {error}</p>
    </div>
  {:else}
    <iframe
      bind:this={iframeRef}
      src="/mitosis-sandbox.html"
      sandbox="allow-scripts allow-same-origin"
      class="sandbox-iframe"
      title="Mitosis Component Sandbox"
      loading="lazy"
    ></iframe>
  {/if}
</div>

<style>
  .sandbox-container {
    width: 100%;
    min-height: 200px;
    position: relative;
  }

  .sandbox-iframe {
    width: 100%;
    min-height: 200px;
    border: none;
    display: block;
  }

  .sandbox-error {
    padding: 1rem;
    background: #fee;
    border: 1px solid #fcc;
    border-radius: 0.5rem;
    color: #c33;
  }
</style>

