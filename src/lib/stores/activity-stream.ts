import { writable } from 'svelte/store';

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

