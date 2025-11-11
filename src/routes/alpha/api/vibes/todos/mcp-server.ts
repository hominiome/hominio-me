import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { decideToolCall } from '$lib/ai/redpill-client.js';
import { loadView } from '$lib/mitosis/view-loader';

// In-memory storage for MVP (no auth/user isolation)
const todosStore: Array<{
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
  dueDate?: string;
}> = [];

/**
 * Creates and configures the Todos MCP server
 * This function is called by the dynamic route handler
 */
export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'todos-vibe',
    version: '1.0.0'
  });

  // Register handle_user_request tool - uses AI to determine which tool to call
  server.registerTool(
    'handle_user_request',
    {
      title: 'Handle User Request',
      description: 'Process a user request and determine which tool to call with extracted parameters',
      inputSchema: {
        userRequest: z.string().describe('The user\'s request or transcript')
      },
      outputSchema: {
        toolName: z.string(),
        result: z.any(),
        ui: z.any().optional()
      }
    },
    async ({ userRequest }) => {
      // Get list of available tools
      const availableTools = [
        {
          name: 'list_todos',
          description: 'List all todos',
          inputSchema: {}
        },
        {
          name: 'create_todo',
          description: 'Create a new todo',
          inputSchema: {
            title: z.string().describe('The title of the todo'),
            dueDate: z.string().optional().describe('Optional due date (ISO format)')
          }
        }
      ];

      // Use AI to decide which tool to call
      const decision = await decideToolCall(userRequest, availableTools);

      // Call the appropriate tool
      let result: any;
      let ui: any;

      if (decision.toolName === 'list_todos') {
        const output = { todos: todosStore };
        ui = loadView('todo-list', { todos: todosStore });
        result = { ...output, ui };
      } else if (decision.toolName === 'create_todo') {
        const { title, dueDate } = decision.arguments;
        const newTodo = {
          id: `todo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          title,
          completed: false,
          createdAt: new Date().toISOString(),
          ...(dueDate && { dueDate })
        };
        todosStore.push(newTodo);
        const output = { todo: newTodo, success: true };
        ui = loadView('todo-created', { todo: newTodo });
        result = { ...output, ui };
      } else {
        throw new Error(`Unknown tool: ${decision.toolName}`);
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        structuredContent: {
          toolName: decision.toolName,
          result,
          ui
        }
      };
    }
  );

  // Register list_todos tool
  server.registerTool(
    'list_todos',
    {
      title: 'List Todos',
      description: 'List all todos',
      inputSchema: {}, // Empty object for no input parameters
      outputSchema: {
        todos: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            completed: z.boolean(),
            createdAt: z.string(),
            dueDate: z.string().optional()
          })
        )
      }
    },
    async () => {
      const output = { todos: todosStore };
      const ui = loadView('todo-list', { todos: todosStore });
      return {
        content: [{ type: 'text', text: JSON.stringify(output) }],
        structuredContent: { ...output, ui }
      };
    }
  );

  // Register create_todo tool
  server.registerTool(
    'create_todo',
    {
      title: 'Create Todo',
      description: 'Create a new todo',
      inputSchema: {
        title: z.string().describe('The title of the todo'),
        dueDate: z.string().optional().describe('Optional due date (ISO format)')
      },
      outputSchema: {
        todo: z.object({
          id: z.string(),
          title: z.string(),
          completed: z.boolean(),
          createdAt: z.string(),
          dueDate: z.string().optional()
        }),
        success: z.boolean()
      }
    },
    async ({ title, dueDate }) => {
      const newTodo = {
        id: `todo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title,
        completed: false,
        createdAt: new Date().toISOString(),
        ...(dueDate && { dueDate })
      };

      todosStore.push(newTodo);

      const output = { todo: newTodo, success: true };
      const ui = loadView('todo-created', { todo: newTodo });
      return {
        content: [{ type: 'text', text: JSON.stringify(output) }],
        structuredContent: { ...output, ui }
      };
    }
  );

  return server;
}

