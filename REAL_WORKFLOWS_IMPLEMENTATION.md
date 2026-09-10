# Real Agentic Workflows Implementation

## Overview
All demo implementations have been removed and replaced with real agentic workflows that connect the workspace UI to the orchestrator, database, and actual agent execution system with real-time streaming.

## Architecture

### Flow Diagram
```
User sends message in Workspace
    ↓
Workspace.tsx → Tauri commands
    ↓
1. prepare_task (route to appropriate agent)
2. get_or_create_agent (get/create agent in DB)
3. create_conversation (if first message)
4. add_message (store user message in DB)
5. create_task (create task in DB)
    ↓
OrchestratorClient.runAgent(agentId)
    ↓
Orchestrator Sidecar (Node.js process)
    ↓
OrchestratorService.executeAgentTask()
    ↓
Events emitted via stdout:
  - task_started
  - agent_thinking (reasoning + expected outcome)
  - action_started (for each tool call)
  - action_completed/action_failed
  - task_completed
    ↓
Sidecar captures events → forwards to Tauri
    ↓
Tauri emits to frontend
    ↓
Workspace event listeners update messages state
    ↓
BoltStyleChat renders messages with visual indicators
```

## Components Changed

### Backend (Rust - Tauri)
**File:** `src-tauri/src/main.rs`
- Added `rusqlite` dependency
- Created database commands:
  - `init_database()` - Initializes DB with schema, creates default user
  - `create_task(agent_id, description)` - Creates task in DB
  - `create_conversation(agent_id, title)` - Creates conversation in DB
  - `add_message(conversation_id, role, content)` - Adds message to DB
  - `get_conversation_messages(conversation_id)` - Retrieves messages
  - `update_task_status(task_id, status, result)` - Updates task
  - `get_or_create_agent(agent_type, user_id)` - Gets or creates agent
- Modified `start_orchestrator_sidecar()` to capture stdout and emit events to frontend

**File:** `src-tauri/Cargo.toml`
- Added `rusqlite = { version = "0.31", features = ["bundled"] }`

### Orchestrator
**File:** `src/orchestrator/index.ts`
- Added `emitEvent()` method that writes events to stdout
- Emits events at key points during task execution:
  - `task_started` - When task begins
  - `agent_thinking` - When LLM responds with reasoning
  - `action_started` - Before each tool execution
  - `action_completed` - After successful tool execution
  - `action_failed` - When tool execution fails
  - `task_completed` - When task finishes with results

**File:** `orchestrator-sidecar.js`
- Completely rewritten to use real OrchestratorService
- Captures events from OrchestratorService stdout
- Forwards events to Tauri via special `TAURI_EVENT:` prefix
- Handles commands from parent process (start_agent, pause_agent, get_status, etc.)

**File:** `vite.orchestrator.config.ts` (new)
- Vite configuration to bundle orchestrator TypeScript code
- Outputs ES modules to `dist/orchestrator/`

**File:** `package.json`
- Added build script: `"build:orchestrator": "vite build --config vite.orchestrator.config.ts"`

### Frontend
**File:** `src/App.tsx`
- Added database initialization on app startup
- Calls `invoke('init_database')` when app loads

**File:** `src/screens/Workspace.tsx`
- **Removed all demo/fallback code**
- Integrated real database operations
- Connected to orchestrator client
- Added event listeners for all agent events:
  - `task_started` - Shows "Starting task..." message
  - `agent_thinking` - Shows reasoning with Brain icon
  - `action_started` - Shows "Executing {tool}..." with Zap icon
  - `action_completed` - Shows completion with checkmark
  - `action_failed` - Shows error message
  - `task_completed` - Shows final result
- Real flow:
  1. User sends message
  2. Create conversation (if first message)
  3. Save user message to DB
  4. Create task in DB
  5. Start agent via orchestrator
  6. Listen for streaming events
  7. Update UI in real-time

**File:** `src/components/ui/bolt-style-chat.tsx`
- Enhanced message display with visual indicators:
  - **Thinking:** Cyan italic text with Brain icon
  - **Executing:** Amber text with pulsing Zap icon
  - **Completed:** Green text with checkmark
  - **Error:** Red text with warning icon
  - **Done:** Emerald text with Sparkles icon
- Added smooth animations for new messages (fade in + slide up)
- Messages show timestamps on hover

## Building & Testing

### Prerequisites
1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the orchestrator:
   ```bash
   npm run build:orchestrator
   ```

3. Set environment variables (optional):
   ```bash
   export ANTHROPIC_API_KEY="your-key"
   export COMPOSIO_API_KEY="your-key"
   export MODE="cloud"  # or "local" for Ollama
   ```

### Testing in Development
```bash
npm run dev
```

### Building for Production
```bash
# Build orchestrator first
npm run build:orchestrator

# Build the app
npm run tauri build
```

### Testing the Flow
1. **Open the app** and complete onboarding if needed
2. **Navigate to Workspace**
3. **Send a message** like "Find local restaurants"
4. **Observe the flow:**
   - Message appears immediately
   - "I've routed this to..." message shows with tools ready
   - "Starting task..." appears
   - Agent thinking shows with reasoning (italic, cyan)
   - Actions execute one by one (amber, pulsing)
   - Results appear (green checkmarks)
   - Final completion message (emerald sparkles)

### Expected Database Structure
Location: `~/.agentiq/agentiq.db`

Tables populated:
- `users` - Default user created on first run
- `agents` - Agent created when first task is sent
- `conversations` - Conversation created for each workspace session
- `messages` - All user and assistant messages stored
- `tasks` - Each task created and tracked
- `logs` - Agent execution logs

### Debugging
1. **Check Tauri console** for backend logs:
   - Database initialization
   - Orchestrator events
   - Command invocations

2. **Check browser console** for frontend logs:
   - `[Workspace]` - Workspace operations
   - `[Orchestrator]` - Orchestrator events
   - Event payloads

3. **Check orchestrator sidecar output:**
   - `[Orchestrator Sidecar]` - Sidecar lifecycle
   - `[Orchestrator]` - Orchestrator execution logs

4. **Inspect database:**
   ```bash
   sqlite3 ~/.agentiq/agentiq.db
   sqlite> SELECT * FROM tasks;
   sqlite> SELECT * FROM messages;
   sqlite> SELECT * FROM logs;
   ```

## Event Types Reference

### task_started
```json
{
  "taskId": 123,
  "agentId": 1,
  "description": "Find local restaurants"
}
```

### agent_thinking
```json
{
  "taskId": 123,
  "agentId": 1,
  "reasoning": "I need to search for restaurants nearby using Google Maps",
  "expectedOutcome": "A list of local restaurants with ratings"
}
```

### action_started
```json
{
  "taskId": 123,
  "agentId": 1,
  "tool": "google_maps_search",
  "params": { "query": "restaurants near me" },
  "description": "Searching Google Maps"
}
```

### action_completed
```json
{
  "taskId": 123,
  "agentId": 1,
  "tool": "google_maps_search",
  "result": { "places": [...] },
  "success": true
}
```

### action_failed
```json
{
  "taskId": 123,
  "agentId": 1,
  "tool": "google_maps_search",
  "error": "API rate limit exceeded"
}
```

### task_completed
```json
{
  "taskId": 123,
  "agentId": 1,
  "result": {
    "plan": {
      "reasoning": "...",
      "actions": [...]
    },
    "actions": [...],
    "completedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

## Key Improvements
1. ✅ **No more demo code** - All fallbacks and mocks removed
2. ✅ **Real database** - Tasks, conversations, messages persisted
3. ✅ **Real orchestrator** - Actual OrchestratorService executing
4. ✅ **Real-time streaming** - Events flow from orchestrator to UI instantly
5. ✅ **Visual feedback** - Clear indicators for each stage of execution
6. ✅ **Error handling** - Failed actions and errors properly displayed
7. ✅ **Smooth UX** - Animations and loading states throughout

## Next Steps
- Test with actual Anthropic API key
- Test with Composio integrations
- Test with Ollama in local mode
- Add more comprehensive error recovery
- Add ability to cancel running tasks
- Add conversation history persistence and loading
