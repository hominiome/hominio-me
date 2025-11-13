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
        },
        {
          name: 'edit_todo',
          description: 'Edit or update an existing todo. Can update title, completed status, or due date. Use id or title to identify the todo.',
          inputSchema: {
            id: z.string().optional().describe('The ID of the todo to edit'),
            title: z.string().optional().describe('The current title of the todo to identify it (if ID not provided)'),
            newTitle: z.string().optional().describe('New title for the todo'),
            completed: z.boolean().optional().describe('Mark todo as completed (true) or not completed (false)'),
            dueDate: z.string().optional().describe('New due date (ISO format)')
          }
        },
        {
          name: 'delete_todo',
          description: 'Delete an existing todo. Use id or title to identify the todo to delete.',
          inputSchema: {
            id: z.string().optional().describe('The ID of the todo to delete'),
            title: z.string().optional().describe('The title of the todo to delete (if ID not provided)')
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
      } else if (decision.toolName === 'edit_todo') {
        const { id, title, newTitle, completed, dueDate } = decision.arguments;
        const currentTodos = [...todosStore];
        
        let todoToEdit = id ? todosStore.find(t => t.id === id) : undefined;
        if (!todoToEdit && title) {
          todoToEdit = todosStore.find(t => t.title.toLowerCase().includes(title.toLowerCase()));
        }
        
        if (!todoToEdit) {
          const todosContext = currentTodos.length > 0
            ? `Available todos:\n${currentTodos.map((t, i) => `${i + 1}. ${t.title} (ID: ${t.id})`).join('\n')}`
            : 'No todos available to edit.';
          throw new Error(`Todo not found. ${todosContext}`);
        }

        if (newTitle !== undefined) todoToEdit.title = newTitle;
        if (completed !== undefined) todoToEdit.completed = completed;
        if (dueDate !== undefined) todoToEdit.dueDate = dueDate;

        const output = { todo: todoToEdit, success: true, todos: todosStore };
        ui = loadView('todo-list', { todos: todosStore });
        result = { ...output, ui };
      } else if (decision.toolName === 'delete_todo') {
        const { id, title } = decision.arguments;
        const currentTodos = [...todosStore];
        
        let todoToDelete = id ? todosStore.find(t => t.id === id) : undefined;
        if (!todoToDelete && title) {
          todoToDelete = todosStore.find(t => t.title.toLowerCase().includes(title.toLowerCase()));
        }
        
        if (!todoToDelete) {
          const todosContext = currentTodos.length > 0
            ? `Available todos:\n${currentTodos.map((t, i) => `${i + 1}. ${t.title} (ID: ${t.id})`).join('\n')}`
            : 'No todos available to delete.';
          throw new Error(`Todo not found. ${todosContext}`);
        }

        const index = todosStore.findIndex(t => t.id === todoToDelete!.id);
        if (index !== -1) todosStore.splice(index, 1);

        const output = { deleted: todoToDelete, success: true, todos: todosStore };
        ui = loadView('todo-list', { todos: todosStore });
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

