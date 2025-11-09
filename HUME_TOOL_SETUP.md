# Hume EVI Tool Configuration

## Tool Name
`execute_action`

## Tool Title
Execute Action

## Tool Description
Universal tool for executing any action. Hume's built-in LLM automatically extracts the action name and all parameters from the user's natural language request. Fully generic, flexible, and configurable - works with any action type (todos, emails, meetings, etc.). Hume handles all the intelligent parsing!

## Tool JSON Schema

**⚠️ IMPORTANT:** When pasting into the Hume Dashboard, use ONLY the schema below (not the wrapper object). The dashboard's "Parameters" field expects just the JSON schema, not the full tool definition.

```json
{
  "type": "object",
  "properties": {
    "action": {
      "type": "string",
      "description": "The name of the action to execute. Extract from the user's request intelligently. Examples: 'list_todos' for listing todos, 'create_todo' for creating todos, 'send_email' for sending emails, 'schedule_meeting' for scheduling meetings, etc. Use snake_case format."
    },
    "params": {
      "type": "object",
      "description": "Dynamic parameters for the action. Extract all relevant parameters from the user's request based on the action being executed. For example: for 'create_todo', extract 'title' and optionally 'dueDate'; for 'send_email', extract 'to', 'subject', 'body'; for 'schedule_meeting', extract 'title', 'date', 'time', 'attendees', etc. Convert dates to ISO 8601 format when mentioned. This object accepts any properties dynamically."
    }
  },
  "required": ["action"]
}
```

**Note:** If you're using the Hume API directly (not the dashboard), you would use a wrapper format with `name`, `description`, and `parameters` fields. But for the dashboard UI, paste only the schema above.

**How it works:** Hume's built-in LLM (Claude/OpenAI/etc.) automatically:
- Reads the tool schema descriptions
- Extracts the `action` from user's natural language (e.g., "show todos" → "list_todos", "send an email" → "send_email")
- Extracts all relevant `params` based on the action (e.g., for todos: `{title: "buy groceries", dueDate: "2024-01-15"}`; for emails: `{to: "john@example.com", subject: "Hello", body: "..."}`)
- Converts relative dates to ISO 8601 format automatically
- Calls the tool with the extracted action and params

**Fully Generic & Flexible:** This tool works with ANY action type - just register new action handlers in your backend. No schema changes needed!

No third-party services needed - Hume's LLM does all the intelligent parsing!

## Available Actions

The system automatically detects and executes actions based on the user's request. Actions are registered in your backend's `actionHandlers` registry.

### Example Actions:

**Todos:**
- `list_todos` - "show me my todos", "list all my tasks"
- `create_todo` - "create a todo to buy groceries", "add a task to call mom tomorrow"
  - Params: `{title: string, dueDate?: string}`

**Emails (example):**
- `send_email` - "send an email to john@example.com about the meeting"
  - Params: `{to: string, subject: string, body: string}`

**Meetings (example):**
- `schedule_meeting` - "schedule a meeting tomorrow at 2pm with Sarah"
  - Params: `{title: string, date: string, time: string, attendees: string[]}`

**Adding New Actions:**
Simply register new handlers in your backend's `actionHandlers` object. The tool schema is fully generic - no changes needed!

## How to Add to Hume Dashboard

1. Go to your Hume EVI configuration dashboard
2. Navigate to the Tools section
3. Click "Add Tool" or "Create Tool"
4. Fill in the tool metadata:
   - **Name:** `execute_action`
   - **Title:** `Execute Action`
   - **Description:** `Universal tool for executing any action. Hume's built-in LLM automatically extracts the action name and all parameters from the user's natural language request. Fully generic, flexible, and configurable - works with any action type (todos, emails, meetings, etc.). Hume handles all the intelligent parsing!`
5. In the **Parameters** field, paste ONLY the JSON schema (the code block above starting with `{"type": "object",...}`)
   - ⚠️ **Do NOT paste the wrapper object** with `name`, `title`, `description`, `parametersSchema`
   - The Parameters field expects just the schema itself
   - The schema has `action` and `params` fields - Hume's LLM extracts these automatically!
   - `params` is a flexible object that accepts any dynamic parameters (no need for `additionalProperties` - Hume's LLM will extract whatever params are needed)
6. Save the configuration

The tool will now be available for Hume EVI to call when users make requests like "show me my todos" or "create a todo to buy groceries".

