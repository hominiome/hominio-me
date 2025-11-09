/**
 * Core standardized voice tools - direct action execution
 * Simple, clean tool calling without MCP protocol overhead
 */

export interface ActionResponse {
  success: boolean;
  action: string;
  result: any;
  ui?: any; // Mitosis JSON UI definition
}

/**
 * Execute an action directly
 * This is the universal tool that Hume will call
 * 
 * Hume's LLM automatically extracts action and params from user's natural language.
 * Fully generic - can handle any action type with any parameters.
 * @param action - Action name (extracted by Hume's LLM)
 * @param params - Parameters object with any dynamic parameters (extracted by Hume's LLM)
 */
export async function executeAction(
  action: string,
  params: Record<string, any> = {}
): Promise<ActionResponse> {
  try {
    const body = {
      action,
      params  // Any dynamic parameters - already extracted by Hume's LLM
    };

    const response = await fetch('/alpha/api/execute-action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data as ActionResponse;
  } catch (error: any) {
    console.error('[Core Tools] Action execution failed:', error);
    throw error;
  }
}

