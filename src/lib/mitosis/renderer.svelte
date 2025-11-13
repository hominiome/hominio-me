<script lang="ts">
  import { validateMitosisConfig } from './validator';
  import type { MitosisConfig, MitosisNode } from './types';

  let { config, onMCPToolCall = null }: {
    config: MitosisConfig | any;
    onMCPToolCall?: ((tool: string, params?: Record<string, any>) => void) | null;
  } = $props();

  let validatedConfig: MitosisConfig | null = $state(null);
  let error: string | null = $state(null);

  // Validate config on mount/update - reactive to config changes
  $effect(() => {
    // Access config to track it reactively
    const currentConfig = config;
    
    try {
      // Normalize config format first
      const normalized = normalizeConfig(currentConfig);
      if (!normalized) {
        throw new Error('Invalid config format');
      }
      const validated = validateMitosisConfig(normalized);
      // Deep clone to ensure reactivity detects changes
      validatedConfig = JSON.parse(JSON.stringify(validated));
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
        if (path.includes('?')) {
          // Simple ternary: "item.completed ? '✓ Completed' : '○ Pending'"
          const parts = path.split('?');
          if (parts.length !== 2) {
            return undefined;
          }
          
          const condition = parts[0].trim();
          const rest = parts[1];
          
          // Split on colon (but be careful with nested colons in strings)
          const colonIndex = rest.lastIndexOf(':');
          if (colonIndex === -1) {
            return undefined;
          }
          
          const trueVal = rest.substring(0, colonIndex).trim();
          const falseVal = rest.substring(colonIndex + 1).trim();
          
          // Allow string literals (quoted values)
          const trueIsString = (trueVal.startsWith("'") && trueVal.endsWith("'")) || 
                               (trueVal.startsWith('"') && trueVal.endsWith('"'));
          const falseIsString = (falseVal.startsWith("'") && falseVal.endsWith("'")) || 
                                (falseVal.startsWith('"') && falseVal.endsWith('"'));
          
          if (!trueIsString || !falseIsString) {
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
  function resolvePath(path: string, state: Record<string, any>): any {
    const parts = path.split('.');
    let current: any = state;

    for (const part of parts) {
      if (current === null || current === undefined) {
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

{#if error}
  <div class="rounded-lg bg-alert-50 border border-alert-200 p-4 text-alert-700">
    <p>Error rendering component: {error}</p>
  </div>
{:else if validatedConfig}
  {@const componentState = validatedConfig.state || {}}
  {@const state = { state: componentState }}
  <div class="w-full" data-component-name={validatedConfig.name}>
    {#each validatedConfig.nodes as node}
      {@render renderNode(node, state)}
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
    {@const className = String(attrs.class || attrs.className || '')}
    <div class={className} {...Object.fromEntries(Object.entries(attrs).filter(([k]) => k !== 'class' && k !== 'className'))}>
      {#if 'children' in node && node.children}
        {#each node.children as child}
          {@render renderNode(child, state)}
        {/each}
      {/if}
    </div>
  {:else if node.name === 'span'}
    {@const attrs = node.attributes || {}}
    {@const className = String(attrs.class || attrs.className || '')}
    <span class={className} {...Object.fromEntries(Object.entries(attrs).filter(([k]) => k !== 'class' && k !== 'className'))}>
      {#if 'children' in node && node.children}
        {#each node.children as child}
          {@render renderNode(child, state)}
        {/each}
      {/if}
    </span>
  {:else if node.name === 'section'}
    {@const attrs = node.attributes || {}}
    {@const className = String(attrs.class || attrs.className || '')}
    <section class={className} {...Object.fromEntries(Object.entries(attrs).filter(([k]) => k !== 'class' && k !== 'className'))}>
      {#if 'children' in node && node.children}
        {#each node.children as child}
          {@render renderNode(child, state)}
        {/each}
      {/if}
    </section>
  {:else if node.name === 'article'}
    {@const attrs = node.attributes || {}}
    {@const className = String(attrs.class || attrs.className || '')}
    <article class={className} {...Object.fromEntries(Object.entries(attrs).filter(([k]) => k !== 'class' && k !== 'className'))}>
      {#if 'children' in node && node.children}
        {#each node.children as child}
          {@render renderNode(child, state)}
        {/each}
      {/if}
    </article>
  {:else if node.name === 'header'}
    {@const attrs = node.attributes || {}}
    {@const className = String(attrs.class || attrs.className || '')}
    <header class={className} {...Object.fromEntries(Object.entries(attrs).filter(([k]) => k !== 'class' && k !== 'className'))}>
      {#if 'children' in node && node.children}
        {#each node.children as child}
          {@render renderNode(child, state)}
        {/each}
      {/if}
    </header>
  {:else if node.name === 'footer'}
    {@const attrs = node.attributes || {}}
    {@const className = String(attrs.class || attrs.className || '')}
    <footer class={className} {...Object.fromEntries(Object.entries(attrs).filter(([k]) => k !== 'class' && k !== 'className'))}>
      {#if 'children' in node && node.children}
        {#each node.children as child}
          {@render renderNode(child, state)}
        {/each}
      {/if}
    </footer>
  {:else if node.name === 'Text'}
    {@const textBinding = node.bindings?.text}
    {@const text = textBinding ? resolveBinding(textBinding, state) : ''}
    {@const className = String(node.attributes?.class || node.attributes?.className || '')}
    <!-- DIONYS body text style -->
    <span class="{className}" style="font-size: 1rem; font-weight: 400; line-height: 1.5; color: #6b7280;">
      {#if text}
        {text}
      {:else if 'children' in node && node.children}
        {#each node.children as child}
          {@render renderNode(child, state)}
        {/each}
      {/if}
    </span>
  {:else if node.name === 'Heading'}
    {@const level = node.attributes?.level || 2}
    {@const textBinding = node.bindings?.text}
    {@const text = textBinding ? resolveBinding(textBinding, state) : ''}
    {@const className = String(node.attributes?.class || node.attributes?.className || '')}
    {#if level === 1}
      <!-- Large title with brand navy color -->
      <h1 class="my-4 text-3xl md:text-4xl font-bold text-brand-navy-500 leading-tight tracking-tight {className}" style="line-height: 1.3; letter-spacing: -0.01em;">
        {#if text}
          {text}
        {:else if 'children' in node && node.children}
          {#each node.children as child}
            {@render renderNode(child, state)}
          {/each}
        {/if}
      </h1>
    {:else if level === 2}
      <!-- Heading with brand navy color -->
      <h2 class="my-3 text-xl md:text-2xl font-semibold text-brand-navy-500 leading-tight {className}" style="line-height: 1.3;">
        {#if text}
          {text}
        {:else if 'children' in node && node.children}
          {#each node.children as child}
            {@render renderNode(child, state)}
          {/each}
        {/if}
      </h2>
    {:else if level === 3}
      <!-- Smaller headings with brand navy color -->
      <h3 class="my-2 text-xl md:text-2xl font-semibold text-brand-navy-500 leading-tight {className}" style="line-height: 1.4;">
        {#if text}
          {text}
        {:else if 'children' in node && node.children}
          {#each node.children as child}
            {@render renderNode(child, state)}
          {/each}
        {/if}
      </h3>
    {:else if level === 4}
      <h4 class="my-2 text-lg md:text-xl font-semibold text-brand-navy-500 leading-tight {className}" style="line-height: 1.4;">
        {#if text}
          {text}
        {:else if 'children' in node && node.children}
          {#each node.children as child}
            {@render renderNode(child, state)}
          {/each}
        {/if}
      </h4>
    {:else if level === 5}
      <h5 class="my-2 text-base md:text-lg font-semibold text-brand-navy-500 {className}" style="line-height: 1.4;">
        {#if text}
          {text}
        {:else if 'children' in node && node.children}
          {#each node.children as child}
            {@render renderNode(child, state)}
          {/each}
        {/if}
      </h5>
    {:else}
      <h6 class="my-2 text-sm md:text-base font-semibold text-brand-navy-500 {className}" style="line-height: 1.4;">
        {#if text}
          {text}
        {:else if 'children' in node && node.children}
          {#each node.children as child}
            {@render renderNode(child, state)}
          {/each}
        {/if}
      </h6>
    {/if}
  {:else if node.name === 'Card'}
    {@const className = String(node.attributes?.class || node.attributes?.className || '')}
    <div class="{className}">
      {#if 'children' in node && node.children}
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
      class="px-4 py-2 bg-primary-500 text-primary-100 border-2 border-primary-500 rounded-lg font-semibold transition-all duration-200 hover:bg-transparent hover:border-primary-500 hover:text-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 cursor-pointer"
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
    <div class="flex flex-col gap-3">
      {#if Array.isArray(items) && items.length > 0}
        {#each items as item, index}
          {#if 'children' in node && node.children}
            {#each node.children as child}
              {@const itemState = { ...state, item, index }}
              {@render renderNode(child, itemState)}
            {/each}
          {/if}
        {/each}
      {:else}
        <div class="p-6 text-center text-gray-500 italic bg-gray-50 rounded-xl border border-gray-200">No items</div>
      {/if}
    </div>
  {:else if node.name === 'Show'}
    {@const whenBinding = node.bindings?.when}
    {@const when = whenBinding ? resolveBinding(whenBinding, state) : false}
    {#if when}
      {#if 'children' in node && node.children}
        {#each node.children as child}
          {@render renderNode(child, state)}
        {/each}
      {/if}
    {/if}
  {:else if node.name === 'Container' || node.name === 'Stack' || node.name === 'Box'}
    {@const className = String(node.attributes?.class || node.attributes?.className || '')}
    <div class={className}>
      {#if 'children' in node && node.children}
        {#each node.children as child}
          {@render renderNode(child, state)}
        {/each}
      {/if}
    </div>
  {:else}
    <!-- Fallback: render as div -->
    <div class="p-2 border border-dashed border-gray-300 rounded" data-component={node.name}>
      {#if 'children' in node && node.children}
        {#each node.children as child}
          {@render renderNode(child, state)}
        {/each}
      {/if}
    </div>
  {/if}
{/snippet}

<style>
  /* Mitosis Card component now uses pure CSS classes from the view JSON */

  /* Todo list container */
  :global(.todo-list-container) {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  /* Todo items grid - matches DIONYS items-grid */
  :global(.todo-items-grid) {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  /* Todo item card - organic design with brand colors */
  :global(.todo-item-card) {
    background: var(--color-brand-cream-50);
    border: 1px solid rgba(8, 27, 71, 0.1);
    border-radius: 16px;
    padding: 1.5rem;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 2px 8px rgba(8, 27, 71, 0.06), 0 1px 3px rgba(8, 27, 71, 0.04);
  }

  :global(.todo-item-card:hover) {
    background: white;
    border-color: rgba(45, 166, 180, 0.3);
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(45, 166, 180, 0.12), 0 2px 8px rgba(45, 166, 180, 0.08);
  }

  /* Todo item header - matches DIONYS item-header */
  :global(.todo-item-header) {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    width: 100%;
  }

  /* Todo item title section - matches DIONYS item-title-section */
  :global(.todo-item-title-section) {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
    min-width: 0;
  }

  /* Todo item name - matches DIONYS item-name */
  :global(.todo-item-name) {
    display: block;
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: #1f2937; /* DIONYS dark text */
    flex: 1;
    min-width: 0;
    line-height: 1.4;
  }

  /* Todo status badge - matches DIONYS total-item-price style but with yellow */
  :global(.todo-status-badge) {
    font-weight: 600;
    color: white;
    background: var(--color-accent-500); /* Yellow accent instead of #ea580c */
    font-size: 0.875rem;
    padding: 0.375rem 0.75rem;
    border-radius: 6px;
    flex-shrink: 0;
    min-width: fit-content;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-size: 0.75rem;
  }

  /* Menu list container - matches todo list container */
  :global(.menu-list-container) {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  /* Menu items grid - matches todo items grid */
  :global(.menu-items-grid) {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  /* Menu item card - compact, clean design with top teal accent */
  :global(.menu-item-card) {
    background: white;
    border-top: 3px solid var(--color-secondary-500);
    border-left: 1px solid rgba(45, 166, 180, 0.2);
    border-right: 1px solid rgba(45, 166, 180, 0.2);
    border-bottom: 1px solid rgba(45, 166, 180, 0.2);
    border-radius: 16px;
    padding: 1.25rem 1.5rem;
    box-shadow: 0 1px 6px rgba(45, 166, 180, 0.08);
    position: relative;
  }

  /* Menu item header - matches DIONYS item-header */
  :global(.menu-item-header) {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    width: 100%;
  }

  /* Menu item title section - matches DIONYS item-title-section */
  :global(.menu-item-title-section) {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex: 1;
    min-width: 0;
  }

  /* Menu item name - large, bold title */
  :global(.menu-item-name) {
    display: block;
    margin: 0;
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-brand-navy-700);
    flex: 1;
    min-width: 0;
    line-height: 1.3;
    letter-spacing: -0.01em;
  }

  /* Menu item description - smaller, subtle */
  :global(.menu-item-description) {
    display: block;
    margin: 0;
    font-size: 0.875rem;
    font-weight: 400;
    color: #64748b;
    line-height: 1.5;
    margin-top: 0.25rem;
  }

  /* Menu item pricing - matches DIONYS item-pricing */
  :global(.menu-item-pricing) {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  /* Menu item price - huge, bold teal price */
  :global(.menu-item-price) {
    font-weight: 800;
    color: var(--color-secondary-600);
    font-size: 1.75rem;
    text-align: right;
    min-width: fit-content;
    flex-shrink: 0;
    display: flex;
    align-items: baseline;
    gap: 0.375rem;
    letter-spacing: -0.03em;
  }

  /* Menu item unit - tiny, subtle label */
  :global(.menu-item-unit) {
    font-size: 0.6875rem;
    font-weight: 500;
    color: var(--color-secondary-500);
  }

  /* SPA & Beauty List Container - matches menu-list style */
  :global(.spa-beauty-list-container) {
    width: 100%;
  }

  :global(.spa-beauty-services-grid) {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-top: 1.5rem;
    width: 100%;
  }

  /* SPA & Beauty Service Card - organic design with brand colors */
  :global(.spa-beauty-service-card) {
    background: var(--color-brand-cream-50);
    border: 1px solid rgba(8, 27, 71, 0.1);
    border-radius: 16px;
    padding: 1.5rem;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    box-shadow: 0 2px 8px rgba(8, 27, 71, 0.06), 0 1px 3px rgba(8, 27, 71, 0.04);
  }

  :global(.spa-beauty-service-card:hover) {
    background: white;
    border-color: rgba(45, 166, 180, 0.3);
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(45, 166, 180, 0.12), 0 2px 8px rgba(45, 166, 180, 0.08);
  }

  :global(.spa-beauty-service-header) {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
  }

  :global(.spa-beauty-service-title-section) {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex: 1;
    min-width: 0;
  }

  :global(.spa-beauty-service-name) {
    display: block;
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: #1f2937; /* DIONYS dark text */
    flex: 1;
    min-width: 0;
    line-height: 1.4;
  }

  :global(.spa-beauty-service-description) {
    display: block;
    margin: 0;
    font-size: 0.875rem;
    font-weight: 400;
    color: #6b7280; /* DIONYS gray text */
    line-height: 1.5;
  }

  :global(.spa-beauty-service-pricing) {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  :global(.spa-beauty-service-price) {
    font-weight: 600;
    color: #1f2937; /* DIONYS dark text */
    font-size: 1rem;
    text-align: right;
    min-width: fit-content;
    flex-shrink: 0;
    display: flex;
    align-items: baseline;
    gap: 0.25rem;
  }

  :global(.spa-beauty-service-unit) {
    font-size: 0.875rem;
    font-weight: 500;
    color: #6b7280; /* DIONYS gray text */
  }

  :global(.spa-beauty-service-duration) {
    font-size: 0.75rem;
    font-weight: 500;
    color: #9ca3af; /* DIONYS light gray */
  }

  /* Time Slot Selection Styles for Mini-Modal */
  :global(.time-slot-selection-container) {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  :global(.time-slot-selection-header) {
    margin-bottom: 0.5rem;
  }

  :global(.time-slot-selection-title) {
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--color-accent-900);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0;
  }

  :global(.time-slot-selection-message) {
    font-size: 0.75rem;
    font-weight: 500;
    color: #6b7280; /* DIONYS gray text */
    margin-bottom: 0.5rem;
  }

  :global(.time-slots-grid) {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: 0.5rem;
  }

  :global(.time-slot-item) {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 0.5rem 0.75rem;
    text-align: center;
    font-size: 0.75rem;
    font-weight: 600;
    color: #1f2937; /* DIONYS dark text */
    cursor: pointer;
    transition: all 0.2s ease;
  }

  :global(.time-slot-item:hover) {
    background: var(--color-accent-500);
    border-color: var(--color-accent-500);
    color: var(--color-accent-900);
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(244, 208, 63, 0.2);
  }

  /* Taxi List Styles - matches SPA/Beauty style */
  :global(.taxi-list-container) {
    width: 100%;
  }

  :global(.taxi-services-list) {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-top: 1.5rem;
    width: 100%;
  }

  :global(.taxi-service-card) {
    background: var(--color-brand-cream-50);
    border: 1px solid rgba(8, 27, 71, 0.1);
    border-radius: 16px;
    padding: 1.5rem;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 2px 8px rgba(8, 27, 71, 0.06), 0 1px 3px rgba(8, 27, 71, 0.04);
  }

  :global(.taxi-service-card:hover) {
    background: white;
    border-color: rgba(45, 166, 180, 0.3);
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(45, 166, 180, 0.12), 0 2px 8px rgba(45, 166, 180, 0.08);
  }

  :global(.taxi-service-header) {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
  }

  :global(.taxi-service-title-section) {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex: 1;
    min-width: 0;
  }

  :global(.taxi-service-name) {
    display: block;
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: #1f2937;
    line-height: 1.4;
  }

  :global(.taxi-service-description) {
    display: block;
    margin: 0;
    font-size: 0.875rem;
    font-weight: 400;
    color: #6b7280;
    line-height: 1.5;
  }

  :global(.taxi-service-pricing) {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  :global(.taxi-service-price) {
    font-weight: 600;
    color: #1f2937;
    font-size: 1rem;
    text-align: right;
    min-width: fit-content;
  }

  /* Room Service List Styles - matches SPA/Beauty style */
  :global(.room-service-list-container) {
    width: 100%;
  }

  :global(.room-service-services-list) {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-top: 1.5rem;
    width: 100%;
  }

  :global(.room-service-service-card) {
    background: var(--color-brand-cream-50);
    border: 1px solid rgba(8, 27, 71, 0.1);
    border-radius: 16px;
    padding: 1.5rem;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 2px 8px rgba(8, 27, 71, 0.06), 0 1px 3px rgba(8, 27, 71, 0.04);
  }

  :global(.room-service-service-card:hover) {
    background: white;
    border-color: rgba(45, 166, 180, 0.3);
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(45, 166, 180, 0.12), 0 2px 8px rgba(45, 166, 180, 0.08);
  }

  :global(.room-service-service-header) {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
  }

  :global(.room-service-service-title-section) {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex: 1;
    min-width: 0;
  }

  :global(.room-service-service-name) {
    display: block;
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: #1f2937;
    line-height: 1.4;
  }

  :global(.room-service-service-description) {
    display: block;
    margin: 0;
    font-size: 0.875rem;
    font-weight: 400;
    color: #6b7280;
    line-height: 1.5;
  }

  :global(.room-service-service-pricing) {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  :global(.room-service-service-price) {
    font-weight: 600;
    color: #1f2937;
    font-size: 1rem;
    text-align: right;
    min-width: fit-content;
    display: flex;
    align-items: baseline;
    gap: 0.25rem;
  }

  :global(.room-service-service-unit) {
    font-size: 0.875rem;
    font-weight: 500;
    color: #6b7280;
  }

  /* Order Confirmation Styles for Mini-Modal */
  :global(.order-confirmation-container) {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0;
  }

  :global(.order-confirmation-header) {
    margin-bottom: 0.75rem;
    padding-bottom: 0.75rem;
    border-bottom: 2px solid rgba(45, 166, 180, 0.3);
  }

  :global(.order-confirmation-title) {
    font-size: 1rem;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.95);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0;
  }

  :global(.order-items-list) {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  :global(.order-item) {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.375rem 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  :global(.order-item:last-child) {
    border-bottom: none;
  }

  :global(.order-item-name) {
    font-size: 0.75rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  :global(.order-item-time-slot) {
    font-size: 0.625rem;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.7);
    font-style: italic;
  }

  :global(.order-item-price) {
    font-size: 0.75rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.95);
    margin-left: 1rem;
  }

  :global(.order-total) {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 0.75rem;
    margin-top: 0.75rem;
    border-top: 3px solid var(--color-secondary-400);
  }

  :global(.order-total-label) {
    font-size: 0.75rem;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.95);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  :global(.order-total-amount) {
    font-size: 0.875rem;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.95);
  }

  /* Cart container - matches order confirmation style */
  :global(.cart-container) {
    width: 100%;
  }

  :global(.cart-header) {
    margin-bottom: 0.75rem;
    padding-bottom: 0.75rem;
    border-bottom: 2px solid rgba(45, 166, 180, 0.3);
  }

  :global(.cart-title) {
    font-size: 1rem;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.95);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  :global(.cart-items-list) {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  :global(.cart-item) {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  :global(.cart-item:last-child) {
    border-bottom: none;
  }

  :global(.cart-item-name) {
    font-size: 0.75rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  :global(.cart-item-time-slot) {
    font-size: 0.625rem;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.7);
    font-style: italic;
  }

  :global(.cart-item-price) {
    font-size: 0.75rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.95);
    margin-left: 1rem;
  }

  :global(.cart-total) {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 0.75rem;
    margin-top: 0.75rem;
    border-top: 3px solid var(--color-secondary-400);
  }

  :global(.cart-total-label) {
    font-size: 0.75rem;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.95);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  :global(.cart-total-amount) {
    font-size: 0.875rem;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.95);
  }
</style>

