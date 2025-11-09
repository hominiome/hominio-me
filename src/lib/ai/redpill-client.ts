/**
 * Red Pill API client for AI-powered tool selection and parameter extraction
 */

interface RedPillMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface RedPillResponse {
  choices?: Array<{
    message?: {
      role?: string;
      content?: string;
    };
  }>;
  // Some APIs return content directly
  content?: string;
  message?: {
    content?: string;
  };
}

export interface ToolCallDecision {
  toolName: string;
  arguments: Record<string, any>;
}

/**
 * Use Red Pill API to determine which tool to call and extract parameters
 */
export async function decideToolCall(
  userRequest: string,
  availableTools: Array<{
    name: string;
    description: string;
    inputSchema: any;
  }>
): Promise<ToolCallDecision> {
  const apiKey = process.env.SECRET_RED_PILL_API_KEY;
  const baseUrl = process.env.SECRET_RED_PILL_BASE_URL || 'https://api.redpill.ai/v1';
  const model = process.env.AI_MODEL || 'phala/qwen2.5-vl-72b-instruct';

  if (!apiKey) {
    throw new Error('SECRET_RED_PILL_API_KEY not configured');
  }

  // Build tool descriptions for the AI
  const toolsDescription = availableTools
    .map(
      (tool) => `- ${tool.name}: ${tool.description}
  Input schema: ${JSON.stringify(tool.inputSchema)}`
    )
    .join('\n\n');

  const systemPrompt = `You are an AI assistant that helps users interact with a todo management system.

Available tools:
${toolsDescription}

When a user makes a request, analyze it and determine:
1. Which tool to call
2. What parameters to pass (extract from the user's request)

Respond with ONLY a JSON object in this exact format:
{
  "toolName": "name_of_tool",
  "arguments": {
    "param1": "value1",
    "param2": "value2"
  }
}

Examples:
- User: "show me my todos" -> {"toolName": "list_todos", "arguments": {}}
- User: "create a todo to buy groceries" -> {"toolName": "create_todo", "arguments": {"title": "buy groceries"}}
- User: "add a task to call mom tomorrow" -> {"toolName": "create_todo", "arguments": {"title": "call mom", "dueDate": "2024-01-15"}}`;

  const messages: RedPillMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userRequest }
  ];

  try {
    console.log('[Red Pill] Calling API:', { baseUrl, model, userRequest: userRequest.substring(0, 50) });
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.3,
        response_format: { type: 'json_object' }
      })
    });

    console.log('[Red Pill] Response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Red Pill] API error:', errorText);
      throw new Error(`Red Pill API error: ${response.status} - ${errorText}`);
    }

    const data: RedPillResponse = await response.json();
    console.log('[Red Pill] Response data keys:', Object.keys(data));
    
    // Handle different response formats
    const content = data.content || 
                   data.message?.content || 
                   data.choices?.[0]?.message?.content;

    if (!content) {
      console.error('[Red Pill] Unexpected response format:', JSON.stringify(data, null, 2));
      throw new Error('No response content from Red Pill API');
    }

    console.log('[Red Pill] Extracted content:', content.substring(0, 200));

    // Parse the JSON response
    let decision: ToolCallDecision;
    try {
      decision = JSON.parse(content) as ToolCallDecision;
    } catch (parseError: any) {
      console.error('[Red Pill] Failed to parse JSON:', parseError);
      console.error('[Red Pill] Content was:', content);
      throw new Error(`Failed to parse Red Pill response as JSON: ${parseError.message}`);
    }

    // Validate the decision
    if (!decision.toolName || !decision.arguments) {
      console.error('[Red Pill] Invalid decision format:', decision);
      throw new Error('Invalid tool call decision format');
    }

    console.log('[Red Pill] Decision:', decision);
    return decision;
  } catch (error: any) {
    console.error('[Red Pill] Error deciding tool call:', error);
    throw new Error(`Failed to decide tool call: ${error.message}`);
  }
}

