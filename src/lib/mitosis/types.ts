// Safe Mitosis JSON Schema Types
// Only allows safe operations - no code execution

export interface MitosisTextNode {
  name: 'text';
  bindings?: {
    text?: string | { code: string };
  };
}

export interface MitosisComponentNode {
  name: string;
  attributes?: Record<string, string | number | boolean>;
  bindings?: Record<string, any>;
  children?: MitosisNode[];
}

export type MitosisNode = MitosisTextNode | MitosisComponentNode;

export interface MitosisComponent {
  name: string;
  state?: Record<string, any>;
  nodes: MitosisNode[];
}

// Official Mitosis JSON format
export interface MitosisConfig {
  '@type': '@builder.io/mitosis/component';
  name: string;
  state?: Record<string, any>;
  nodes: MitosisNode[];
  // Additional Mitosis properties
  meta?: Record<string, any>;
  imports?: any[];
  props?: any[];
  hooks?: any;
  children?: MitosisNode[];
}

// Allowed component names (whitelist)
// With sandboxing, we can allow more Mitosis features
export const ALLOWED_COMPONENTS = [
  // HTML elements
  'div',
  'span',
  'section',
  'article',
  'header',
  'footer',
  'nav',
  'main',
  'aside',
  'p',
  'a',
  'img',
  'ul',
  'ol',
  'li',
  'table',
  'thead',
  'tbody',
  'tr',
  'td',
  'th',
  'form',
  'label',
  'select',
  'option',
  'textarea',
  // Mitosis components
  'List',
  'ListItem',
  'Card',
  'Button',
  'Input',
  'Text',
  'Heading',
  'Image',
  'Badge',
  'Icon',
  'Container',
  'Stack',
  'Box',
  'Show', // Mitosis conditional rendering
  'For', // Mitosis list rendering
  'Fragment', // Mitosis fragment
  'text' // Special node type for text content
] as const;

export type AllowedComponent = (typeof ALLOWED_COMPONENTS)[number];

// Allowed binding types
export type AllowedBinding =
  | { type: 'data_binding'; path: string } // {{path}}
  | { type: 'static'; value: string | number | boolean }
  | { type: 'mcp_tool_call'; tool: string; params?: Record<string, any> }
  | { type: 'code'; code: string }; // Only for static strings in text nodes

// Forbidden operations
export const FORBIDDEN_PATTERNS = [
  'eval',
  'Function',
  'window',
  'document',
  'require',
  'import(',
  'innerHTML',
  'outerHTML',
  '__proto__',
  'constructor'
];

