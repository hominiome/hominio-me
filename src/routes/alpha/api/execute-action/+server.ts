import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// In-memory storage for MVP (no auth/user isolation)
const todosStore: Array<{
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
  dueDate?: string;
}> = [];

// Generate Mitosis JSON UI for list_todos
function generateListTodosUI(todos: typeof todosStore) {
  const heading = {
    name: 'Heading',
    attributes: {
      level: 2
    },
    children: [
      {
        name: 'text',
        bindings: {
          text: "'Your Todos'"
        }
      }
    ]
  };
  
  const content = todos.length === 0
    ? [
        {
          name: 'div',
          attributes: {
            class: 'empty-state'
          },
          children: [
            {
              name: 'Text',
              bindings: {
                text: "'No todos yet. Create one with your voice!'"
              }
            }
          ]
        }
      ]
    : [
        {
          name: 'List',
          bindings: {
            items: '{{state.todos}}'
          },
          children: [
            {
              name: 'Card',
              bindings: {
                key: '{{item.id}}'
              },
              children: [
                {
                  name: 'div',
                  attributes: {
                    class: 'todo-item'
                  },
                  children: [
                    {
                      name: 'Text',
                      bindings: {
                        text: '{{item.title}}'
                      }
                    },
                    {
                      name: 'Text',
                      attributes: {
                        class: 'todo-status'
                      },
                      bindings: {
                        text: "{{item.completed ? '✓ Completed' : '○ Pending'}}"
                      }
                    }
                  ]
                }
              ]
            }
          ]
        }
      ];
  
  return {
    '@type': '@builder.io/mitosis/component',
    name: 'TodoList',
    state: {
      todos: todos
    },
    nodes: [
      {
        name: 'div',
        attributes: {
          class: 'todo-list-container'
        },
        children: [heading, ...content]
      }
    ]
  };
}

// Generate Mitosis JSON UI for create_todo response
function generateCreateTodoUI(todo: typeof todosStore[0]) {
  return {
    '@type': '@builder.io/mitosis/component',
    name: 'TodoCreated',
    state: {
      todo: todo
    },
    nodes: [
      {
        name: 'div',
        attributes: {
          class: 'todo-created'
        },
        children: [
          {
            name: 'Text',
            bindings: {
              text: "'✓ Todo created successfully!'"
            }
          },
          {
            name: 'Card',
            children: [
              {
                name: 'Text',
                bindings: {
                  text: '{{state.todo.title}}'
                }
              }
            ]
          }
        ]
      }
    ]
  };
}

// Action handlers registry
const actionHandlers: Record<string, (params: any) => Promise<{ result: any; ui?: any }>> = {
  async list_todos() {
    const output = { todos: todosStore };
    const ui = generateListTodosUI(todosStore);
    return {
      result: output,
      ui
    };
  },

  async create_todo(params: { title: string; dueDate?: string }) {
    const { title, dueDate } = params;
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
    const ui = generateCreateTodoUI(newTodo);
    return {
      result: output,
      ui
    };
  }
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

