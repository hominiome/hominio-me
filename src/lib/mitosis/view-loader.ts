import type { MitosisConfig } from './types';
import todoListView from './views/todo-list.json';
import todoCreatedView from './views/todo-created.json';

// View registry - maps view-id to view config
const viewRegistry: Record<string, MitosisConfig> = {
  'todo-list': todoListView as MitosisConfig,
  'todo-created': todoCreatedView as MitosisConfig,
};

/**
 * Load a preconfigured Mitosis view by view-id
 * Views are stored as JSON files in src/lib/mitosis/views/
 */
export function loadView(viewId: string, state?: Record<string, any>): MitosisConfig | null {
  try {
    console.log(`[View Loader] Loading view "${viewId}", available views:`, Object.keys(viewRegistry));
    const view = viewRegistry[viewId];
    
    if (!view) {
      console.error(`[View Loader] View "${viewId}" not found. Available views: ${Object.keys(viewRegistry).join(', ')}`);
      return null;
    }
    
    console.log(`[View Loader] Found view "${viewId}":`, view);
    
    // Deep clone the view to avoid mutating the original
    const clonedView: MitosisConfig = JSON.parse(JSON.stringify(view));
    
    // Merge provided state with view's default state
    if (state && clonedView.state) {
      clonedView.state = { ...clonedView.state, ...state };
    } else if (state) {
      clonedView.state = state;
    }
    
    console.log(`[View Loader] Returning cloned view "${viewId}" with state:`, clonedView.state);
    return clonedView;
  } catch (err) {
    console.error(`[View Loader] Failed to load view "${viewId}":`, err);
    return null;
  }
}

/**
 * Get available view IDs
 */
export function getAvailableViews(): string[] {
  return Object.keys(viewRegistry);
}

/**
 * Register a new view (for runtime registration if needed)
 */
export function registerView(viewId: string, view: MitosisConfig): void {
  viewRegistry[viewId] = view;
}

