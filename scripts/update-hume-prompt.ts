/**
 * Script to update the Hume EVI config prompt with available todo actions
 * 
 * Run with: bun run scripts/update-hume-prompt.ts <CONFIG_ID>
 * 
 * This updates the prompt to inform the AI about all available todo actions:
 * - list_todos
 * - create_todo
 * - edit_todo
 * - delete_todo
 */

const HUME_API_KEY = process.env.HUME_API_KEY;

if (!HUME_API_KEY) {
    console.error('❌ HUME_API_KEY environment variable not set');
    process.exit(1);
}

const CONFIG_ID = process.argv[2];

if (!CONFIG_ID) {
    console.error('❌ Please provide the config ID as an argument');
    console.error('Usage: bun run scripts/update-hume-prompt.ts <CONFIG_ID>');
    console.error('\nYou can find your config ID in your .env file as PUBLIC_HUME_CONFIG_ID');
    process.exit(1);
}

async function updateConfigPrompt() {
    try {
        console.log(`🔧 Fetching current config ${CONFIG_ID}...`);

        // First, get the current config
        const getResponse = await fetch(`https://api.hume.ai/v0/evi/configs/${CONFIG_ID}`, {
            headers: {
                'X-Hume-Api-Key': HUME_API_KEY
            }
        });

        if (!getResponse.ok) {
            const errorText = await getResponse.text();
            throw new Error(`Failed to fetch config: ${getResponse.status} - ${errorText}`);
        }

        const currentConfig = await getResponse.json();
        console.log('✅ Current config fetched');

        // Update the prompt with available actions
        const updatedPrompt = `You are Hominio, a friendly and helpful voice assistant.

You have access to actions through the execute_action tool. Available todo actions:

1. **list_todos** - Show all todos
   - Use when: user asks to see their todos, list todos, show todos, etc.
   - Example: "show me my todos" -> execute_action with action: "list_todos", params: {}

2. **create_todo** - Create a new todo
   - Use when: user wants to add a new todo item
   - Parameters: { title: string, dueDate?: string }
   - Example: "add buy groceries" -> execute_action with action: "create_todo", params: {title: "buy groceries"}

3. **edit_todo** - Edit or update an existing todo
   - Use when: user wants to update a todo's title, mark it as completed, or change its due date
   - Parameters: { id?: string, title?: string, newTitle?: string, completed?: boolean, dueDate?: string }
   - Use "title" to identify the todo if ID is not known
   - Examples:
     - "mark buy groceries as completed" -> execute_action with action: "edit_todo", params: {title: "buy groceries", completed: true}
     - "update buy groceries to buy bananas" -> execute_action with action: "edit_todo", params: {title: "buy groceries", newTitle: "buy bananas"}
     - "change the title of buy groceries to buy bananas" -> execute_action with action: "edit_todo", params: {title: "buy groceries", newTitle: "buy bananas"}

4. **delete_todo** - Delete a todo
   - Use when: user wants to remove a todo from their list
   - Parameters: { id?: string, title?: string }
   - Use "title" to identify the todo if ID is not known
   - Example: "delete buy groceries" -> execute_action with action: "delete_todo", params: {title: "buy groceries"}

When users ask to update, change, modify, or edit a todo, use the edit_todo action. You can update the title, mark it as completed, or change the due date.

The execute_action tool is fully dynamic - you can call any action with any parameters. Extract the action name and parameters intelligently from the user's request.

Be conversational and natural. Keep responses concise and helpful.`;

        // Update the config with the new prompt
        const updatePayload = {
            ...currentConfig,
            prompt: {
                text: updatedPrompt
            }
        };

        console.log('🔧 Updating config prompt...');
        const updateResponse = await fetch(`https://api.hume.ai/v0/evi/configs/${CONFIG_ID}`, {
            method: 'PUT',
            headers: {
                'X-Hume-Api-Key': HUME_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatePayload)
        });

        if (!updateResponse.ok) {
            const errorText = await updateResponse.text();
            throw new Error(`Failed to update config: ${updateResponse.status} - ${errorText}`);
        }

        const updatedConfig = await updateResponse.json();
        console.log('✅ Config prompt updated successfully!');
        console.log('\nThe AI now knows about all available todo actions including edit_todo.');
        console.log('You can test it by saying: "update buy groceries to buy bananas"');

        return updatedConfig;
    } catch (error: any) {
        console.error('❌ Error updating config:', error.message);
        process.exit(1);
    }
}

// Run the script
updateConfigPrompt();

