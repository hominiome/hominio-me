<script lang="ts">
  import { validateMitosisConfig } from './validator';
  import type { MitosisConfig, MitosisNode } from './types';

  let { config, onMCPToolCall = null }: {
    config: MitosisConfig | any;
    onMCPToolCall?: ((tool: string, params?: Record<string, any>) => void) | null;
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
    <p class="my-2 text-base text-primary-700 leading-relaxed {className}">
      {#if text}
        {text}
      {:else if 'children' in node && node.children}
        {#each node.children as child}
          {@render renderNode(child, state)}
        {/each}
      {/if}
    </p>
  {:else if node.name === 'Heading'}
    {@const level = node.attributes?.level || 2}
    {@const textBinding = node.bindings?.text}
    {@const text = textBinding ? resolveBinding(textBinding, state) : ''}
    {@const className = String(node.attributes?.class || node.attributes?.className || '')}
    {#if level === 1}
      <h1 class="my-4 text-3xl md:text-4xl font-bold text-primary-500 leading-tight tracking-tight {className}">
        {#if text}
          {text}
        {:else if 'children' in node && node.children}
          {#each node.children as child}
            {@render renderNode(child, state)}
          {/each}
        {/if}
      </h1>
    {:else if level === 2}
      <h2 class="my-3 text-2xl md:text-3xl font-bold text-primary-500 leading-tight tracking-tight {className}">
        {#if text}
          {text}
        {:else if 'children' in node && node.children}
          {#each node.children as child}
            {@render renderNode(child, state)}
          {/each}
        {/if}
      </h2>
    {:else if level === 3}
      <h3 class="my-2 text-xl md:text-2xl font-semibold text-primary-500 leading-tight {className}">
        {#if text}
          {text}
        {:else if 'children' in node && node.children}
          {#each node.children as child}
            {@render renderNode(child, state)}
          {/each}
        {/if}
      </h3>
    {:else if level === 4}
      <h4 class="my-2 text-lg md:text-xl font-semibold text-primary-500 leading-tight {className}">
        {#if text}
          {text}
        {:else if 'children' in node && node.children}
          {#each node.children as child}
            {@render renderNode(child, state)}
          {/each}
        {/if}
      </h4>
    {:else if level === 5}
      <h5 class="my-2 text-base md:text-lg font-semibold text-primary-500 {className}">
        {#if text}
          {text}
        {:else if 'children' in node && node.children}
          {#each node.children as child}
            {@render renderNode(child, state)}
          {/each}
        {/if}
      </h5>
    {:else}
      <h6 class="my-2 text-sm md:text-base font-semibold text-primary-500 {className}">
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
    <div class="mitosis-card p-4 md:p-6 bg-white border-2 border-primary-500/6 rounded-2xl transition-all duration-300 overflow-hidden my-2 hover:border-secondary-500/40 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(45,166,180,0.15)] {className}">
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

