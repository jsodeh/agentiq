#!/usr/bin/env node

/**
 * Orchestrator Sidecar Process
 * 
 * This Node.js script runs as a separate process spawned by Tauri.
 * It manages the OrchestratorService and handles agent execution.
 * 
 * Uses dynamic import to load the compiled TypeScript OrchestratorService
 */

import { pathToFileURL } from 'url';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const HOME_DIR = os.homedir();
const DB_PATH = process.env.DB_PATH || join(HOME_DIR, '.agentiq', 'agentiq.db');
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const COMPOSIO_API_KEY = process.env.COMPOSIO_API_KEY || '';
const MODE = process.env.MODE || 'local';
const OLLAMA_ENDPOINT = process.env.OLLAMA_ENDPOINT || 'http://localhost:11434';

console.log('[Orchestrator Sidecar] Starting...');
console.log('[Orchestrator Sidecar] DB Path:', DB_PATH);
console.log('[Orchestrator Sidecar] Mode:', MODE);

let orchestrator = null;

async function main() {
  try {
    // Dynamic import of the compiled OrchestratorService
    const orchestratorPath = join(__dirname, 'dist', 'orchestrator', 'index.js');
    const { OrchestratorService } = await import(pathToFileURL(orchestratorPath).href);

    // Initialize orchestrator with configuration
    orchestrator = new OrchestratorService({
      dbPath: DB_PATH,
      anthropicApiKey: ANTHROPIC_API_KEY,
      composioApiKey: COMPOSIO_API_KEY,
      mode: MODE,
      ollamaEndpoint: OLLAMA_ENDPOINT,
    });

    // Start the orchestrator
    await orchestrator.start();
    console.log('[Orchestrator Sidecar] Orchestrator service started successfully');

    // Set up stdin listener for commands from parent process
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', async (data) => {
      try {
        const command = JSON.parse(data.toString().trim());
        await handleCommand(command);
      } catch (error) {
        console.error('[Orchestrator Sidecar] Failed to parse command:', error);
      }
    });

  } catch (error) {
    console.error('[Orchestrator] Failed to start:', error);
    console.error('[Orchestrator] Stack:', error.stack);
    process.exit(1);
  }
}

/**
 * Handle commands from parent process
 */
async function handleCommand(command) {
  console.log('[Orchestrator Sidecar] Received command:', command.type);

  try {
    switch (command.type) {
      case 'start_agent':
        if (orchestrator) {
          await orchestrator.runAgent(command.agentId);
          sendResponse({ success: true, message: `Agent ${command.agentId} started` });
        }
        break;

      case 'pause_agent':
        if (orchestrator) {
          await orchestrator.pauseAgent(command.agentId);
          sendResponse({ success: true, message: `Agent ${command.agentId} paused` });
        }
        break;

      case 'get_status':
        if (orchestrator) {
          const status = orchestrator.getStatus();
          sendResponse({ success: true, data: status });
        }
        break;

      case 'get_logs':
        if (orchestrator) {
          const logs = orchestrator.getLogs(command.filters);
          sendResponse({ success: true, data: logs });
        }
        break;

      case 'get_escalations':
        if (orchestrator) {
          const escalations = orchestrator.getEscalations(command.status);
          sendResponse({ success: true, data: escalations });
        }
        break;

      default:
        sendResponse({ success: false, error: `Unknown command: ${command.type}` });
    }
  } catch (error) {
    console.error('[Orchestrator Sidecar] Command error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Send response back to parent process
 */
function sendResponse(response) {
  console.log(JSON.stringify(response));
}

/**
 * Handle shutdown signals
 */
async function shutdown(signal) {
  console.log(`[Orchestrator] Received ${signal}, shutting down...`);
  
  if (orchestrator) {
    try {
      await orchestrator.stop();
      orchestrator.close();
    } catch (error) {
      console.error('[Orchestrator] Error during shutdown:', error);
    }
  }
  
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start the sidecar
main().catch(error => {
  console.error('[Orchestrator Sidecar] Fatal error:', error);
  process.exit(1);
});

console.log('[Orchestrator Sidecar] Running. PID:', process.pid);
