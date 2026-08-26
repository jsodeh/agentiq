import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export interface OrchestratorStatus {
  running: boolean;
  activeAgents: number;
  queueSize: number;
  queuePending: number;
}

export interface EscalationEvent {
  escalationId: number;
  agentId: number;
  taskId: number;
  reason: string;
  timestamp: string;
}

/**
 * Client for interacting with the orchestrator service
 */
export class OrchestratorClient {
  private escalationListeners: Array<(event: EscalationEvent) => void> = [];

  constructor() {
    this.setupEscalationListener();
  }

  /**
   * Setup listener for escalation events
   */
  private async setupEscalationListener() {
    try {
      await listen<EscalationEvent>('escalation', (event) => {
        console.log('[Orchestrator] Escalation received:', event.payload);
        this.escalationListeners.forEach(listener => listener(event.payload));
      });
    } catch (error) {
      console.error('[Orchestrator] Failed to setup escalation listener:', error);
    }
  }

  /**
   * Start the orchestrator
   */
  async start(): Promise<void> {
    try {
      await invoke('start_orchestrator_sidecar');
      console.log('[Orchestrator] Started successfully');
    } catch (error) {
      console.error('[Orchestrator] Failed to start:', error);
      throw error;
    }
  }

  /**
   * Stop the orchestrator
   */
  async stop(): Promise<void> {
    try {
      await invoke('stop_orchestrator_sidecar');
      console.log('[Orchestrator] Stopped successfully');
    } catch (error) {
      console.error('[Orchestrator] Failed to stop:', error);
      throw error;
    }
  }

  /**
   * Get orchestrator status
   */
  async getStatus(): Promise<OrchestratorStatus> {
    try {
      const status = await invoke<any>('get_orchestrator_status');
      return {
        running: status.running || false,
        activeAgents: 0, // Would be populated by actual orchestrator
        queueSize: 0,
        queuePending: 0,
      };
    } catch (error) {
      console.error('[Orchestrator] Failed to get status:', error);
      throw error;
    }
  }

  /**
   * Run a specific agent
   */
  async runAgent(agentId: number): Promise<void> {
    try {
      await invoke('start_agent', { agentId });
      console.log(`[Orchestrator] Agent ${agentId} started`);
    } catch (error) {
      console.error(`[Orchestrator] Failed to start agent ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * Pause a specific agent
   */
  async pauseAgent(agentId: number): Promise<void> {
    try {
      await invoke('stop_agent', { agentId });
      console.log(`[Orchestrator] Agent ${agentId} paused`);
    } catch (error) {
      console.error(`[Orchestrator] Failed to pause agent ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * Subscribe to escalation events
   */
  onEscalation(callback: (event: EscalationEvent) => void): () => void {
    this.escalationListeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.escalationListeners.indexOf(callback);
      if (index > -1) {
        this.escalationListeners.splice(index, 1);
      }
    };
  }

  /**
   * Get logs with filters
   */
  async getLogs(filters?: {
    agentId?: number;
    level?: 'info' | 'warning' | 'error';
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<any[]> {
    // This would call a Tauri command that queries the database
    // For now, return empty array
    return [];
  }

  /**
   * Get escalations
   */
  async getEscalations(status?: 'pending' | 'resolved' | 'dismissed'): Promise<any[]> {
    // This would call a Tauri command that queries the database
    // For now, return empty array
    return [];
  }
}

// Singleton instance
let orchestratorClient: OrchestratorClient | null = null;

/**
 * Get the orchestrator client instance
 */
export function getOrchestratorClient(): OrchestratorClient {
  if (!orchestratorClient) {
    orchestratorClient = new OrchestratorClient();
  }
  return orchestratorClient;
}
