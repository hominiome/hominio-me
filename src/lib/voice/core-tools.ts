/**
 * Core standardized voice tools that forward to MCP endpoints
 * These tools are registered with Hume and can interact with any vibe
 */

export interface MCPToolCallParams {
  vibeId: string;
  userRequest: string;
}

export interface MCPToolResponse {
  result: any;
  ui?: any; // Mitosis JSON UI definition
}

/**
 * Call an MCP tool on a vibe
 * This is the standardized tool that Hume will call
 * The MCP server uses AI to determine which tool to call based on the user's request
 */
export async function callMCPTool(
  vibeId: string,
  userRequest: string
): Promise<MCPToolResponse> {
  try {
    // The route is /alpha/api/vibes/{vibeId} (POST endpoint)
    const response = await fetch(`/alpha/api/vibes/${vibeId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'handle_user_request',
          arguments: {
            userRequest
          }
        },
        id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      })
    });

    if (!response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const error = await response.json();
        throw new Error(error.error?.message || `HTTP ${response.status}`);
      } else {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text.substring(0, 100)}`);
      }
    }

    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      const text = await response.text();
      throw new Error(`Expected JSON but got ${contentType}: ${text.substring(0, 100)}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || 'MCP tool call failed');
    }

    return data.result as MCPToolResponse;
  } catch (error: any) {
    console.error('[Core Tools] MCP tool call failed:', error);
    throw error;
  }
}

/**
 * Get available tools for a vibe
 */
export async function listMCPTools(vibeId: string): Promise<any[]> {
  try {
    // The route is /alpha/api/vibes/{vibeId} (POST endpoint)
    const response = await fetch(`/alpha/api/vibes/${vibeId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/list',
        params: {},
        id: `list_${Date.now()}`
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || 'Failed to list tools');
    }

    return data.result?.tools || [];
  } catch (error: any) {
    console.error('[Core Tools] Failed to list tools:', error);
    return [];
  }
}

