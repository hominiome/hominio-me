<script lang="ts">
  import { validateMitosisConfig } from './validator';
  import type { MitosisConfig, MitosisNode } from './types';
  import { browser } from '$app/environment';
  import SandboxRenderer from './sandbox-renderer.svelte';

  let { config, onMCPToolCall = null, useSandbox = true }: {
    config: MitosisConfig | any;
    onMCPToolCall?: ((tool: string, params?: Record<string, any>) => void) | null;
    useSandbox?: boolean; // Enable sandboxing by default for security
  } = $props();

  let validatedConfig: MitosisConfig | null = $state(null);
  let error: string | null = $state(null);

  // Validate config on mount/update
  $effect(() => {
    try {
      // Normalize config format first
      const normalized = normalizeConfig(config);
      if (!normalized) {
        throw new Error('Invalid config format');
      }
      validatedConfig = validateMitosisConfig(normalized);
      error = null;
    } catch (err: any) {
      error = err.message;
      validatedConfig = null;
      console.error('[Mitosis Renderer] Validation error:', err);
    }
  });

  // Normalize config format (handle both old and new formats)
  function normalizeConfig(config: any): MitosisConfig | null {
    // If it's already in the new format (@builder.io/mitosis/component)
    if (config['@type'] === '@builder.io/mitosis/component') {
      return config as MitosisConfig;
    }
    
    // If it's in the old format (mitosis with component wrapper)
    if (config['@type'] === 'mitosis' && config.component) {
      return {
        '@type': '@builder.io/mitosis/component',
        name: config.component.name,
        state: config.component.state || {},
        nodes: config.component.nodes || []
      };
    }
    
    return null;
  }

  // Resolve data binding (e.g., "{{state.todos}}" -> actual data)
  function resolveBinding(binding: any, state: Record<string, any>): any {
    if (typeof binding === 'string') {
      // Handle template strings like "{{state.todos}}"
      if (binding.startsWith('{{') && binding.endsWith('}}')) {
        const path = binding.slice(2, -2).trim();
        // Handle ternary expressions in template strings
        // SECURITY: Only allows string literals, no function calls
        if (path.includes('?')) {
          // Simple ternary: "item.completed ? '✓ Completed' : '○ Pending'"
          const parts = path.split('?');
          if (parts.length !== 2) {
            console.warn('[Mitosis Renderer] Invalid ternary expression');
            return undefined;
          }
          
          const condition = parts[0].trim();
          const rest = parts[1];
          
          // Split on colon (but be careful with nested colons in strings)
          const colonIndex = rest.lastIndexOf(':');
          if (colonIndex === -1) {
            console.warn('[Mitosis Renderer] Invalid ternary: missing colon');
            return undefined;
          }
          
          const trueVal = rest.substring(0, colonIndex).trim();
          const falseVal = rest.substring(colonIndex + 1).trim();
          
          // Security: Only allow string literals (quoted values)
          const trueIsString = (trueVal.startsWith("'") && trueVal.endsWith("'")) || 
                               (trueVal.startsWith('"') && trueVal.endsWith('"'));
          const falseIsString = (falseVal.startsWith("'") && falseVal.endsWith("'")) || 
                                (falseVal.startsWith('"') && falseVal.endsWith('"'));
          
          if (!trueIsString || !falseIsString) {
            console.warn('[Mitosis Renderer] Ternary values must be string literals');
            return undefined;
          }
          
          const conditionResult = resolvePath(condition, state);
          const trueValue = trueVal.replace(/^['"]|['"]$/g, ''); // Remove quotes
          const falseValue = falseVal.replace(/^['"]|['"]$/g, ''); // Remove quotes
          return conditionResult ? trueValue : falseValue;
        }
        return resolvePath(path, state);
      }
      // Handle static string literals like "'Your Todos'"
      if ((binding.startsWith("'") && binding.endsWith("'")) || 
          (binding.startsWith('"') && binding.endsWith('"'))) {
        return binding.slice(1, -1);
      }
      return binding;
    }

    if (typeof binding === 'object' && binding !== null) {
      // Handle code bindings (for static strings in text nodes)
      if (binding.code) {
        try {
          // Only allow safe property access, no function calls
          const code = binding.code.trim();
          if ((code.startsWith("'") && code.endsWith("'")) || 
              (code.startsWith('"') && code.endsWith('"'))) {
            // Static string literal
            return code.slice(1, -1);
          }
          // Try to resolve as data path
          return resolvePath(code, state);
        } catch (e) {
          console.warn('[Mitosis Renderer] Failed to resolve code binding:', binding.code);
          return binding.code;
        }
      }

      // Handle MCP tool call bindings
      if (binding.type === 'mcp_tool_call') {
        return {
          type: 'mcp_tool_call',
          tool: binding.tool,
          params: binding.params || {}
        };
      }
    }

    return binding;
  }

  // Resolve a path like "state.todos" or "item.title"
  // SECURITY: Only allows safe property access, blocks prototype pollution
  function resolvePath(path: string, state: Record<string, any>): any {
    // Block dangerous property names
    const dangerousProps = ['__proto__', 'constructor', 'prototype', 'eval', 'Function'];
    
    const parts = path.split('.');
    let current: any = state;

    for (const part of parts) {
      // Security check: block dangerous property names
      if (dangerousProps.includes(part)) {
        console.warn('[Mitosis Renderer] Blocked access to dangerous property:', part);
        return undefined;
      }
      
      // Security check: only allow alphanumeric, underscore, and brackets
      if (!/^[a-zA-Z0-9_\[\]]+$/.test(part)) {
        console.warn('[Mitosis Renderer] Invalid property name:', part);
        return undefined;
      }

      if (current === null || current === undefined) {
        return undefined;
      }
      
      // Only allow property access, not method calls
      if (typeof current[part] === 'function') {
        console.warn('[Mitosis Renderer] Blocked function access:', part);
        return undefined;
      }
      
      current = current[part];
    }

    return current;
  }

  // Handle MCP tool call
  function handleMCPToolCall(tool: string, params?: Record<string, any>) {
    if (onMCPToolCall) {
      onMCPToolCall(tool, params);
    } else {
      console.warn('[Mitosis Renderer] MCP tool call requested but no handler provided:', tool, params);
    }
  }
</script>

{#if useSandbox && browser}
  <!-- Use sandboxed renderer for security -->
  <SandboxRenderer {config} {onMCPToolCall} />
{:else if error}
  <div class="mitosis-error">
    <p>Error rendering component: {error}</p>
  </div>
{:else if validatedConfig}
  <!-- Fallback: Direct renderer (less secure, but works without iframe) -->
  {@const state = validatedConfig.state || {}}
  <div class="mitosis-component" data-component-name={validatedConfig.name}>
    {#each validatedConfig.nodes as node}
      {@const rendered = renderNode(node, state)}
      {rendered}
    {/each}
  </div>
{/if}

{#snippet renderNode(node: MitosisNode, state: Record<string, any>)}
  {#if node.name === 'text'}
    {@const textBinding = node.bindings?.text}
    {@const text = textBinding ? resolveBinding(textBinding, state) : ''}
    {text}
  {:else if node.name === 'div'}
    {@const attrs = node.attributes || {}}
    {@const className = attrs.class || attrs.className || ''}
    <div class={className} {...Object.fromEntries(Object.entries(attrs).filter(([k]) => k !== 'class' && k !== 'className'))}>
      {#if node.children}
        {#each node.children as child}
          {@render renderNode(child, state)}
        {/each}
      {/if}
    </div>
  {:else if node.name === 'span'}
    {@const attrs = node.attributes || {}}
    {@const className = attrs.class || attrs.className || ''}
    <span class={className} {...Object.fromEntries(Object.entries(attrs).filter(([k]) => k !== 'class' && k !== 'className'))}>
      {#if node.children}
        {#each node.children as child}
          {@render renderNode(child, state)}
        {/each}
      {/if}
    </span>
  {:else if node.name === 'section'}
    {@const attrs = node.attributes || {}}
    {@const className = attrs.class || attrs.className || ''}
    <section class={className} {...Object.fromEntries(Object.entries(attrs).filter(([k]) => k !== 'class' && k !== 'className'))}>
      {#if node.children}
        {#each node.children as child}
          {@render renderNode(child, state)}
        {/each}
      {/if}
    </section>
  {:else if node.name === 'article'}
    {@const attrs = node.attributes || {}}
    {@const className = attrs.class || attrs.className || ''}
    <article class={className} {...Object.fromEntries(Object.entries(attrs).filter(([k]) => k !== 'class' && k !== 'className'))}>
      {#if node.children}
        {#each node.children as child}
          {@render renderNode(child, state)}
        {/each}
      {/if}
    </article>
  {:else if node.name === 'header'}
    {@const attrs = node.attributes || {}}
    {@const className = attrs.class || attrs.className || ''}
    <header class={className} {...Object.fromEntries(Object.entries(attrs).filter(([k]) => k !== 'class' && k !== 'className'))}>
      {#if node.children}
        {#each node.children as child}
          {@render renderNode(child, state)}
        {/each}
      {/if}
    </header>
  {:else if node.name === 'footer'}
    {@const attrs = node.attributes || {}}
    {@const className = attrs.class || attrs.className || ''}
    <footer class={className} {...Object.fromEntries(Object.entries(attrs).filter(([k]) => k !== 'class' && k !== 'className'))}>
      {#if node.children}
        {#each node.children as child}
          {@render renderNode(child, state)}
        {/each}
      {/if}
    </footer>
  {:else if node.name === 'Text'}
    {@const textBinding = node.bindings?.text}
    {@const text = textBinding ? resolveBinding(textBinding, state) : ''}
    <p class="mitosis-text">{text}</p>
  {:else if node.name === 'Heading'}
    {@const level = node.attributes?.level || 2}
    {@const textBinding = node.bindings?.text}
    {@const text = textBinding ? resolveBinding(textBinding, state) : ''}
    {#if level === 1}
      <h1 class="mitosis-heading">{text}</h1>
    {:else if level === 2}
      <h2 class="mitosis-heading">{text}</h2>
    {:else if level === 3}
      <h3 class="mitosis-heading">{text}</h3>
    {:else if level === 4}
      <h4 class="mitosis-heading">{text}</h4>
    {:else if level === 5}
      <h5 class="mitosis-heading">{text}</h5>
    {:else}
      <h6 class="mitosis-heading">{text}</h6>
    {/if}
  {:else if node.name === 'Card'}
    {@const className = node.attributes?.class || node.attributes?.className || 'mitosis-card'}
    <div class={className}>
      {#if node.children}
        {#each node.children as child}
          {@render renderNode(child, state)}
        {/each}
      {/if}
    </div>
  {:else if node.name === 'Button'}
    {@const textBinding = node.bindings?.text}
    {@const onClickBinding = node.bindings?.onClick}
    {@const text = textBinding ? resolveBinding(textBinding, state) : ''}
    {@const onClick = onClickBinding ? resolveBinding(onClickBinding, state) : null}
    <button
      class="mitosis-button"
      onclick={() => {
        if (onClick?.type === 'mcp_tool_call') {
          handleMCPToolCall(onClick.tool, onClick.params);
        }
      }}
    >
      {text}
    </button>
  {:else if node.name === 'List'}
    {@const itemsBinding = node.bindings?.items}
    {@const items = itemsBinding ? resolveBinding(itemsBinding, state) : []}
    <div class="mitosis-list">
      {#if Array.isArray(items) && items.length > 0}
        {#each items as item, index}
          {#if node.children}
            {#each node.children as child}
              {@const itemState = { ...state, item, index }}
              {@render renderNode(child, itemState)}
            {/each}
          {/if}
        {/each}
      {:else}
        <div class="mitosis-list-empty">No items</div>
      {/if}
    </div>
  {:else if node.name === 'Container' || node.name === 'Stack' || node.name === 'Box'}
    {@const className = node.attributes?.class || node.attributes?.className || `mitosis-${node.name.toLowerCase()}`}
    <div class={className}>
      {#if node.children}
        {#each node.children as child}
          {@render renderNode(child, state)}
        {/each}
      {/if}
    </div>
  {:else}
    <!-- Fallback: render as div -->
    <div class="mitosis-unknown-component" data-component={node.name}>
      {#if node.children}
        {#each node.children as child}
          {@render renderNode(child, state)}
        {/each}
      {/if}
    </div>
  {/if}
{/snippet}

<style>
  .mitosis-component {
    width: 100%;
  }

  .mitosis-error {
    padding: 1rem;
    background: #fee;
    border: 1px solid #fcc;
    border-radius: 0.5rem;
    color: #c33;
  }

  .mitosis-text {
    margin: 0.5rem 0;
  }

  .mitosis-heading {
    margin: 1rem 0 0.5rem 0;
    font-weight: 600;
  }

  .mitosis-card {
    padding: 1rem;
    border: 1px solid #ddd;
    border-radius: 0.5rem;
    margin: 0.5rem 0;
    background: white;
  }

  .mitosis-button {
    padding: 0.5rem 1rem;
    background: var(--color-primary-500);
    color: white;
    border: none;
    border-radius: 0.25rem;
    cursor: pointer;
    font-size: 1rem;
  }

  .mitosis-button:hover {
    background: var(--color-primary-600);
  }

  .mitosis-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .mitosis-unknown-component {
    padding: 0.5rem;
    border: 1px dashed #ccc;
    border-radius: 0.25rem;
  }
</style>

