import { writable } from 'svelte/store';
import { loadView } from '$lib/mitosis/view-loader';

export interface ActivityItem {
  id: string;
  timestamp: string;
  vibeId: string;
  toolName: string;
  result: any;
  ui?: any; // Mitosis JSON UI definition
}

export const activityStream = writable<ActivityItem[]>([]);

export function addActivity(item: Omit<ActivityItem, 'id' | 'timestamp'>) {
  activityStream.update((activities) => [
    ...activities,
    {
      ...item,
      id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString()
    }
  ]);
}

export function clearActivityStream() {
  activityStream.set([]);
}

/**
 * Update the list_todos activity when action tools modify todos
 * This ensures the todo list view stays reactive and up-to-date
 */
export function updateListTodosActivity(todos: any[]) {
  activityStream.update((activities) => {
    const listTodosActivity = activities.find(a => a.toolName === 'list_todos');
    if (listTodosActivity) {
      listTodosActivity.result = { todos };
      // Reload the UI with updated todos
      listTodosActivity.ui = loadView('todo-list', { todos });
    }
    return activities;
  });
}

