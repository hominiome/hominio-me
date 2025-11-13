/**
 * Script to create the getName tool and Hume EVI config
 * 
 * Run with: bun run scripts/create-hume-tool-and-config.ts
 * 
 * This will:
 * 1. Create the getName tool in Hume platform
 * 2. Create a config with that tool
 * 3. Output the config ID to use in your .env
 */

const HUME_API_KEY = process.env.HUME_API_KEY;

if (!HUME_API_KEY) {
  console.error('❌ HUME_API_KEY environment variable not set');
  process.exit(1);
}

async function createTool() {
  try {
    console.log('🔧 Creating getName tool in Hume platform...');

    const toolDefinition = {
      name: 'getName',
      description: 'Returns the name of the assistant. Use this when users ask "what\'s your name", "who are you", or similar questions about your identity.',
      parameters: JSON.stringify({
        type: 'object',
        properties: {},
        required: []
      })
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
        // Try to list tools and find it
        const listResponse = await fetch('https://api.hume.ai/v0/evi/tools', {
          headers: {
            'X-Hume-Api-Key': HUME_API_KEY
          }
        });
        if (listResponse.ok) {
          const toolsData = await listResponse.json();
          // Handle both array and object with results property
          const tools = Array.isArray(toolsData) ? toolsData : (toolsData.results || []);
          const existingTool = tools.find((t: any) => t.name === 'getName');
          if (existingTool) {
            console.log('✅ Found existing getName tool');
            return existingTool.id;
          }
        }
        // If we can't find it, use a known tool ID or ask user to provide it
        console.log('⚠️  Could not automatically find tool. Using tool ID from previous run...');
        // Use the tool ID we got from the first successful run
        return '1d835166-0ee2-4185-a05e-7dda722cdc6d';
      }
      throw new Error(`Failed to create tool: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Tool created successfully!');
    console.log('📋 Tool ID:', data.id);
    return data.id;
  } catch (error: any) {
    console.error('❌ Error creating tool:', error.message);
    throw error;
  }
}

async function createConfig(toolId: string) {
  try {
    console.log('🔧 Creating/updating Hume config with getName tool...');

    const configDefinition = {
      evi_version: '3',
      name: 'Hominio Voice Assistant',
      language_model: {
        model_provider: 'ANTHROPIC',
        model_resource: 'claude-3-5-sonnet-20241022'
      },
      voice: {
        provider: 'HUME_AI',
        name: 'ITO'  // You can change this to any Hume voice
      },
      tools: [
        {
          id: toolId
        }
      ],
      prompt: {
        text: `You are Hominio, a friendly and helpful voice assistant. 

When users ask "what's your name" or "who are you" or similar questions about your identity, use the getName tool to respond with your name.

Be conversational and natural. Keep responses concise and helpful.`
      }
    };

    const response = await fetch('https://api.hume.ai/v0/evi/configs', {
      method: 'POST',
      headers: {
        'X-Hume-Api-Key': HUME_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(configDefinition)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create config: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Config created successfully!');
    console.log('📋 Config ID:', data.id);
    return data.id;
  } catch (error: any) {
    console.error('❌ Error creating config:', error.message);
    throw error;
  }
}

async function main() {
  try {
    // Step 1: Create the tool
    const toolId = await createTool();
    
    // Step 2: Create the config with the tool
    const configId = await createConfig(toolId);
    
    console.log('\n✅ Setup complete!');
    console.log('\n📝 Add to your .env file:');
    console.log(`   PUBLIC_HUME_CONFIG_ID=${configId}`);
    console.log('\nMake sure you also have:');
    console.log('   HUME_API_KEY=your_api_key');
    console.log('   HUME_SECRET_KEY=your_secret_key');
  } catch (error: any) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  }
}

// Run the script
main();

