import type {
  MitosisConfig,
  MitosisNode,
  MitosisComponent,
  AllowedComponent
} from './types';
import { ALLOWED_COMPONENTS, FORBIDDEN_PATTERNS } from './types';

export class MitosisValidationError extends Error {
  constructor(message: string) {
    super(`Mitosis Validation Error: ${message}`);
    this.name = 'MitosisValidationError';
  }
}

/**
 * Validates Mitosis JSON config against safe schema
 */
export function validateMitosisConfig(config: any): MitosisConfig {
  // Check top-level structure
  if (!config || typeof config !== 'object') {
    throw new MitosisValidationError('Config must be an object');
  }

  // Support both formats: @builder.io/mitosis/component (official) and mitosis (legacy)
  if (config['@type'] !== '@builder.io/mitosis/component' && config['@type'] !== 'mitosis') {
    throw new MitosisValidationError('Config must have @type: "@builder.io/mitosis/component" or "mitosis"');
  }

  // Handle official Mitosis format
  if (config['@type'] === '@builder.io/mitosis/component') {
    if (!config.name || typeof config.name !== 'string') {
      throw new MitosisValidationError('Config must have a name');
    }
    if (!Array.isArray(config.nodes)) {
      throw new MitosisValidationError('Config must have a nodes array');
    }
    config.nodes.forEach((node: any, index: number) => {
      validateNode(node, `nodes[${index}]`);
    });
    return config as MitosisConfig;
  }

  // Handle legacy format (mitosis with component wrapper)
  if (config['@type'] === 'mitosis') {
    if (!config.component || typeof config.component !== 'object') {
      throw new MitosisValidationError('Config must have a component property');
    }
    validateComponent(config.component);
    // Convert to official format
    return {
      '@type': '@builder.io/mitosis/component',
      name: config.component.name,
      state: config.component.state || {},
      nodes: config.component.nodes || []
    };
  }

  throw new MitosisValidationError('Invalid config format');
}

/**
 * Validates a Mitosis component
 */
function validateComponent(component: any): void {
  if (!component.name || typeof component.name !== 'string') {
    throw new MitosisValidationError('Component must have a name');
  }

  // Validate nodes
  if (!Array.isArray(component.nodes)) {
    throw new MitosisValidationError('Component must have a nodes array');
  }

  component.nodes.forEach((node: any, index: number) => {
    validateNode(node, `nodes[${index}]`);
  });
}

/**
 * Validates a Mitosis node
 */
function validateNode(node: any, path: string): void {
  if (!node || typeof node !== 'object') {
    throw new MitosisValidationError(`${path}: Node must be an object`);
  }

  if (!node.name || typeof node.name !== 'string') {
    throw new MitosisValidationError(`${path}: Node must have a name`);
  }

  // Check if component is allowed
  if (!ALLOWED_COMPONENTS.includes(node.name as AllowedComponent)) {
    throw new MitosisValidationError(
      `${path}: Component "${node.name}" is not allowed. Allowed: ${ALLOWED_COMPONENTS.join(', ')}`
    );
  }

  // Validate attributes (if present)
  if (node.attributes) {
    if (typeof node.attributes !== 'object') {
      throw new MitosisValidationError(`${path}: attributes must be an object`);
    }

    // Check for forbidden patterns in attribute values
    for (const [key, value] of Object.entries(node.attributes)) {
      const valueStr = String(value);
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (valueStr.includes(pattern)) {
          throw new MitosisValidationError(
            `${path}.attributes.${key}: Contains forbidden pattern "${pattern}"`
          );
        }
      }
    }
  }

  // Validate bindings (if present)
  if (node.bindings) {
    if (typeof node.bindings !== 'object') {
      throw new MitosisValidationError(`${path}: bindings must be an object`);
    }

    for (const [key, binding] of Object.entries(node.bindings)) {
      validateBinding(binding, `${path}.bindings.${key}`);
    }
  }

  // Validate children (if present)
  if (node.children) {
    if (!Array.isArray(node.children)) {
      throw new MitosisValidationError(`${path}: children must be an array`);
    }

    node.children.forEach((child: any, index: number) => {
      validateNode(child, `${path}.children[${index}]`);
    });
  }
}

/**
 * Validates a binding value
 */
function validateBinding(binding: any, path: string): void {
  if (binding === null || binding === undefined) {
    return; // null/undefined bindings are allowed
  }

  // String bindings (data binding or static)
  if (typeof binding === 'string') {
    // Check for forbidden patterns
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (binding.includes(pattern)) {
        throw new MitosisValidationError(
          `${path}: Contains forbidden pattern "${pattern}"`
        );
      }
    }
    return;
  }

  // Object bindings
  if (typeof binding === 'object') {
    // Check for code bindings (only allowed in text nodes for static strings)
    if (binding.code) {
      const codeStr = String(binding.code);
      
      // Check for forbidden patterns
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (codeStr.includes(pattern)) {
          throw new MitosisValidationError(
            `${path}.code: Contains forbidden pattern "${pattern}"`
          );
        }
      }

      // Check for dangerous code patterns
      // Note: With iframe sandboxing, window/document are already blocked by browser
      // But we still block eval/Function/require as defense-in-depth
      const dangerousPatterns = [
        /\beval\s*\(/,
        /\bFunction\s*\(/,
        /\brequire\s*\(/,
        /\bimport\s*\(/,
        /\.__proto__/,
        /\.constructor\s*\(/
        // window/document/innerHTML/outerHTML are safe in sandbox (isolated context)
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(codeStr)) {
          throw new MitosisValidationError(
            `${path}.code: Contains dangerous code pattern`
          );
        }
      }
    }

    // MCP tool call bindings
    if (binding.type === 'mcp_tool_call') {
      if (!binding.tool || typeof binding.tool !== 'string') {
        throw new MitosisValidationError(
          `${path}: MCP tool call must have a tool name`
        );
      }
      return;
    }

    return;
  }

  // Other types (number, boolean) are allowed
  if (typeof binding === 'number' || typeof binding === 'boolean') {
    return;
  }

  throw new MitosisValidationError(
    `${path}: Invalid binding type. Must be string, object, number, or boolean`
  );
}

