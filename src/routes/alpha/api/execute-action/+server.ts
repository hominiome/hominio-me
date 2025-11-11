import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadView } from '$lib/mitosis/view-loader';

// In-memory storage for MVP (no auth/user isolation)
const todosStore: Array<{
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
  dueDate?: string;
}> = [];

// Action handlers registry
const actionHandlers: Record<string, (params: any) => Promise<{ result: any; ui?: any; view?: string }>> = {
  async list_todos(params: { view?: string } = {}) {
    const output = { todos: todosStore };
    
    // Load view by view-id (defaults to 'todo-list' if not specified)
    const viewId = params.view || 'todo-list';
    const ui = loadView(viewId, { todos: todosStore });
    
    return {
      result: output,
      ui,
      view: viewId
    };
  },

  async create_todo(params: { title: string; dueDate?: string; view?: string }) {
    const { title, dueDate, view } = params;
    if (!title) {
      throw new Error('Title is required');
    }

    const newTodo = {
      id: `todo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      completed: false,
      createdAt: new Date().toISOString(),
      ...(dueDate && { dueDate })
    };

    todosStore.push(newTodo);

    const output = { todo: newTodo, success: true };
    
    // Load view by view-id (defaults to 'todo-created' if not specified)
    const viewId = view || 'todo-created';
    const ui = loadView(viewId, { todo: newTodo });
    
    return {
      result: output,
      ui,
      view: viewId
    };
  },
};

/**
 * Universal action execution endpoint
 * POST /alpha/api/execute-action
 * Body: { action: string, params?: Record<string, any> }
 * 
 * Hume's LLM automatically extracts action and params from user's natural language request.
 * The tool schema guides Hume's LLM to intelligently parse the request.
 * This endpoint is fully generic and can handle any action type.
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { action, params = {} } = body;

    if (!action || typeof action !== 'string') {
      return error(400, 'action is required and must be a string');
    }

    const handler = actionHandlers[action];
    if (!handler) {
      return error(404, `Action "${action}" not found`);
    }

    // Execute the action with the extracted params
    const { result, ui } = await handler(params);

    console.log('[Execute Action] Action:', action, 'UI:', ui ? 'present' : 'missing', 'Result:', result);

    return json({
      success: true,
      action,
      result,
      ui
    });
  } catch (err: any) {
    console.error('[Execute Action] Error:', err);
    return error(500, err.message || 'Action execution failed');
  }
};

