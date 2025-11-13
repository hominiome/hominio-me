import { config } from 'dotenv';
config(); // Load environment variables from .env

const HUME_API_KEY = process.env.HUME_API_KEY;

if (!HUME_API_KEY) {
  console.error('❌ HUME_API_KEY environment variable not set');
  process.exit(1);
}

async function updateMCPTool(toolId: string, parametersSchema: any) {
  try {
    console.log(`🔄 Updating existing tool ${toolId}...`);
    
    const toolDefinition = {
      name: 'call_mcp_tool',
      description: `Universal tool to handle user requests for any vibe app. 
The MCP server will use AI to understand the user's intent and call the appropriate tool.
Examples:
- "show me my todos" -> call_mcp_tool with vibeId: "todos", userRequest: "show me my todos"
- "create a new todo to buy groceries" -> call_mcp_tool with vibeId: "todos", userRequest: "create a new todo to buy groceries"
- "show my calendar" -> call_mcp_tool with vibeId: "calendar", userRequest: "show my calendar"`,
      parameters: JSON.stringify(parametersSchema),
      versionDescription: 'Updated to use AI-powered tool selection - Hume just passes userRequest'
    };

    const response = await fetch(`https://api.hume.ai/v0/evi/tools/${toolId}`, {
      method: 'PUT',
      headers: {
        'X-Hume-Api-Key': HUME_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(toolDefinition)
    });
    
    if (response.ok) {
      console.log('✅ Tool updated successfully');
      return toolId;
    } else {
      const errorText = await response.text();
      console.log(`⚠️  Could not update tool: ${response.status} - ${errorText}`);
      return null;
    }
  } catch (err: any) {
    console.log(`⚠️  Error updating tool: ${err.message}`);
    return null;
  }
}

async function deleteMCPTool(toolId: string) {
  try {
    console.log(`🗑️  Deleting existing tool ${toolId}...`);
    const response = await fetch(`https://api.hume.ai/v0/evi/tools/${toolId}`, {
      method: 'DELETE',
      headers: {
        'X-Hume-Api-Key': HUME_API_KEY
      }
    });
    if (response.ok) {
      console.log('✅ Tool deleted successfully');
    } else {
      const errorText = await response.text();
      console.log(`⚠️  Could not delete tool: ${response.status} - ${errorText}`);
    }
  } catch (err: any) {
    console.log(`⚠️  Error deleting tool: ${err.message}`);
  }
}

async function createMCPTool() {
  try {
    console.log('🔧 Creating/updating call_mcp_tool in Hume platform...');

    // Parameters must be a JSON schema string (Hume API expects a string, not an object)
    // Hume just passes the user's request - the MCP server uses AI to determine which tool to call
    const parametersSchema = {
      type: 'object',
      properties: {
        vibeId: {
          type: 'string',
          description: 'The ID of the vibe app (e.g., "todos", "calendar")'
        },
        userRequest: {
          type: 'string',
          description: 'The user\'s request or transcript. Examples: "show me my todos", "create a todo to buy groceries", "add a task to call mom tomorrow"'
        }
      },
      required: ['vibeId', 'userRequest']
    };

    // Try to update the existing tool first (if it exists)
    const existingToolIds = [
      'd01f8e48-9904-4df4-977e-8c360c3ef217', // Original tool ID
      'c09a84dd-e4ca-4b3c-bda1-345c4415d1b3'  // New tool ID from error message
    ];
    
    for (const toolId of existingToolIds) {
      const updatedId = await updateMCPTool(toolId, parametersSchema);
      if (updatedId) {
        return updatedId;
      }
    }

    const toolDefinition = {
      name: 'call_mcp_tool',
      description: `Universal tool to call MCP (Model Context Protocol) tools on any vibe app. 
Use this when users want to interact with vibe apps like todos, calendar, etc.
Examples:
- "show me my todos" -> call_mcp_tool with vibeId: "todos", toolName: "list_todos"
- "create a new todo" -> call_mcp_tool with vibeId: "todos", toolName: "create_todo", params: {title: "..."}
- "show my calendar" -> call_mcp_tool with vibeId: "calendar", toolName: "list_events"`,
      parameters: JSON.stringify(parametersSchema)
    };

    const response = await fetch('https://api.hume.ai/v0/evi/tools', {
      method: 'POST',
      headers: {
        'X-Hume-Api-Key': HUME_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(toolDefinition)
    });

    if (!response.ok) {
      const errorText = await response.text();
      // If tool already exists, try to get it
      if (response.status === 409 || errorText.includes('already exists')) {
        console.log('⚠️  Tool already exists, fetching existing tool...');
        const listResponse = await fetch('https://api.hume.ai/v0/evi/tools', {
          headers: {
            'X-Hume-Api-Key': HUME_API_KEY
          }
        });
        if (listResponse.ok) {
          const toolsData = await listResponse.json();
          const tools = Array.isArray(toolsData) ? toolsData : (toolsData.results || []);
          const existingTool = tools.find((t: any) => t.name === 'call_mcp_tool');
          if (existingTool) {
            console.log('✅ Found existing call_mcp_tool');
            console.log('📋 Tool ID:', existingTool.id);
            return existingTool.id;
          }
        }
        // If we can't find it, use the known tool ID from previous run
        console.log('⚠️  Could not automatically find tool. Using known tool ID...');
        return 'd01f8e48-9904-4df4-977e-8c360c3ef217'; // From previous successful run
      }
      throw new Error(`Failed to create tool: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Tool created successfully!');
    console.log('📋 Tool ID:', data.id);
    return data.id;
  } catch (error: any) {
    console.error('❌ Error creating tool:', error);
    throw new Error(`Setup failed: ${error.message}`);
  }
}

async function updateHumeConfig(toolId: string) {
  try {
    const HUME_CONFIG_ID = process.env.PUBLIC_HUME_CONFIG_ID;

    if (!HUME_CONFIG_ID) {
      console.log('⚠️  PUBLIC_HUME_CONFIG_ID not set, skipping config update');
      console.log('   You can manually add the tool to your Hume config:');
      console.log(`   Tool ID: ${toolId}`);
      return;
    }

    console.log('✅ Tool is ready!');
    console.log('\n📝 Tool ID:', toolId);
    console.log('   You can now use this tool in your Hume config.');
    console.log('   Make sure your existing config includes this tool ID.');
  } catch (error: any) {
    console.error('❌ Error updating config:', error);
    throw new Error(`Config update failed: ${error.message}`);
  }
}

async function setupMCPTool() {
  try {
    const toolId = await createMCPTool();
    await updateHumeConfig(toolId);

    console.log('\n✅ Setup complete!');
    console.log('\n📝 The call_mcp_tool is ready.');
    console.log('   Make sure your Hume config includes this tool ID:', toolId);
    console.log('   You can test it by saying: "show me my todos"');
  } catch (error: any) {
    console.error(error.message);
    process.exit(1);
  }
}

setupMCPTool();

