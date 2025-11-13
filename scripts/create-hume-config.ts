/**
 * Script to create or update Hume EVI config with the getName tool
 * 
 * Run with: bun run scripts/create-hume-config.ts <TOOL_ID>
 * 
 * First, create the tool in Hume platform, then use its ID here
 */

const HUME_API_KEY = process.env.HUME_API_KEY;

if (!HUME_API_KEY) {
  console.error('❌ HUME_API_KEY environment variable not set');
  process.exit(1);
}

const TOOL_ID = process.argv[2];

if (!TOOL_ID) {
  console.error('❌ Please provide the tool ID as an argument');
  console.error('Usage: bun run scripts/create-hume-config.ts <TOOL_ID>');
  console.error('\nFirst, create a tool in Hume platform with:');
  console.log(`
{
  "name": "getName",
  "description": "Returns the name of the assistant",
  "parameters": {
    "type": "object",
    "properties": {},
    "required": []
  }
}
  `);
  process.exit(1);
}

async function createOrUpdateConfig() {
  try {
    console.log('🔧 Creating/updating Hume config with getName tool...');

    const configDefinition = {
      evi_version: '2',
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
          id: TOOL_ID
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
    console.log('\nNext steps:');
    console.log('1. Add to your .env file:');
    console.log(`   PUBLIC_HUME_CONFIG_ID=${data.id}`);
    console.log('2. Make sure HUME_API_KEY and HUME_SECRET_KEY are set in your .env');
    console.log('3. Start your app and test: "What\'s your name?"');
    
    return data;
  } catch (error) {
    console.error('❌ Error creating config:', error);
    process.exit(1);
  }
}

// Run the script
createOrUpdateConfig();

