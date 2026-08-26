import { EventEmitter } from 'events';
import { emit, listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

export interface ComputerUseAction {
  id: string;
  agentId: number;
  sessionId: string;
  action: string;
  description: string;
  params: Record<string, any>;
  risk: 'low' | 'medium' | 'high';
  timestamp: number;
  preview?: {
    url?: string;
    selector?: string;
    value?: string;
    screenshot?: string;
  };
}

export interface ApprovalDecision {
  actionId: string;
  approved: boolean;
  reason?: string;
  timestamp: number;
}

export class ApprovalGate extends EventEmitter {
  private pendingActions: Map<string, ComputerUseAction> = new Map();
  private approvalTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private autoApproveEnabled: boolean = false;
  private approvalTimeout: number = 120000; // 120 seconds

  constructor() {
    super();
    this.setupListeners();
  }

  private setupListeners(): void {
    // Listen for approval/rejection from UI
    listen('approve_computer_use', (event: any) => {
      const { actionId, reason } = event.payload;
      this.handleApproval(actionId, true, reason);
    });

    listen('reject_computer_use', (event: any) => {
      const { actionId, reason } = event.payload;
      this.handleApproval(actionId, false, reason);
    });
  }

  async setAutoApprove(enabled: boolean): Promise<void> {
    this.autoApproveEnabled = enabled;
    console.log(`Auto-approve ${enabled ? 'enabled' : 'disabled'}`);
  }

  async requestApproval(action: ComputerUseAction): Promise<boolean> {
    // Check if auto-approve is enabled
    if (this.autoApproveEnabled) {
      await this.logDecision({
        actionId: action.id,
        approved: true,
        reason: 'Auto-approved',
        timestamp: Date.now(),
      });
      return true;
    }

    // Add to pending actions
    this.pendingActions.set(action.id, action);

    // Emit event to UI
    await emit('computer_use_pending', {
      action: JSON.stringify(action),
    });

    // Set timeout for auto-rejection
    const timeoutId = setTimeout(() => {
      this.handleTimeout(action.id);
    }, this.approvalTimeout);

    this.approvalTimeouts.set(action.id, timeoutId);

    // Wait for approval/rejection
    return new Promise((resolve) => {
      const handler = (decision: ApprovalDecision) => {
        if (decision.actionId === action.id) {
          this.removeListener('decision', handler);
          resolve(decision.approved);
        }
      };

      this.on('decision', handler);
    });
  }

  private async handleApproval(actionId: string, approved: boolean, reason?: string): Promise<void> {
    const action = this.pendingActions.get(actionId);
    if (!action) {
      console.warn(`Action ${actionId} not found in pending actions`);
      return;
    }

    // Clear timeout
    const timeoutId = this.approvalTimeouts.get(actionId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.approvalTimeouts.delete(actionId);
    }

    // Remove from pending
    this.pendingActions.delete(actionId);

    // Log decision
    const decision: ApprovalDecision = {
      actionId,
      approved,
      reason,
      timestamp: Date.now(),
    };

    await this.logDecision(decision);

    // Emit decision event
    this.emit('decision', decision);

    console.log(`Action ${actionId} ${approved ? 'approved' : 'rejected'}`);
  }

  private async handleTimeout(actionId: string): Promise<void> {
    const action = this.pendingActions.get(actionId);
    if (!action) return;

    console.warn(`Action ${actionId} timed out after ${this.approvalTimeout}ms`);

    // Auto-reject
    await this.handleApproval(actionId, false, 'Timeout - no response within 120 seconds');

    // Emit timeout event
    await emit('computer_use_timeout', {
      actionId,
      action: JSON.stringify(action),
    });
  }

  async getPendingActions(): Promise<ComputerUseAction[]> {
    return Array.from(this.pendingActions.values());
  }

  async clearPendingAction(actionId: string): Promise<void> {
    const timeoutId = this.approvalTimeouts.get(actionId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.approvalTimeouts.delete(actionId);
    }

    this.pendingActions.delete(actionId);
  }

  async clearAllPendingActions(): Promise<void> {
    for (const [actionId, timeoutId] of this.approvalTimeouts.entries()) {
      clearTimeout(timeoutId);
    }

    this.approvalTimeouts.clear();
    this.pendingActions.clear();
  }

  private async logDecision(decision: ApprovalDecision): Promise<void> {
    try {
      await invoke('log_approval_decision', {
        decision: JSON.stringify(decision),
      });
    } catch (error) {
      console.error('Failed to log approval decision:', error);
    }
  }

  async getApprovalHistory(agentId?: number, limit: number = 100): Promise<ApprovalDecision[]> {
    try {
      const result = await invoke<string>('get_approval_history', {
        agentId,
        limit,
      });
      return JSON.parse(result);
    } catch (error) {
      console.error('Failed to get approval history:', error);
      return [];
    }
  }

  async getApprovalStats(agentId?: number): Promise<{
    totalActions: number;
    approved: number;
    rejected: number;
    timedOut: number;
    autoApproved: number;
    approvalRate: number;
  }> {
    try {
      const history = await this.getApprovalHistory(agentId, 1000);

      const stats = {
        totalActions: history.length,
        approved: history.filter(d => d.approved && d.reason !== 'Auto-approved').length,
        rejected: history.filter(d => !d.approved && !d.reason?.includes('Timeout')).length,
        timedOut: history.filter(d => d.reason?.includes('Timeout')).length,
        autoApproved: history.filter(d => d.reason === 'Auto-approved').length,
        approvalRate: 0,
      };

      if (stats.totalActions > 0) {
        stats.approvalRate = ((stats.approved + stats.autoApproved) / stats.totalActions) * 100;
      }

      return stats;
    } catch (error) {
      console.error('Failed to get approval stats:', error);
      return {
        totalActions: 0,
        approved: 0,
        rejected: 0,
        timedOut: 0,
        autoApproved: 0,
        approvalRate: 0,
      };
    }
  }

  setApprovalTimeout(timeoutMs: number): void {
    this.approvalTimeout = timeoutMs;
  }

  getApprovalTimeout(): number {
    return this.approvalTimeout;
  }

  isAutoApproveEnabled(): boolean {
    return this.autoApproveEnabled;
  }

  // Risk assessment helper
  static assessRisk(action: string, params: Record<string, any>): 'low' | 'medium' | 'high' {
    const highRiskSelectors = ['input[type="password"]', 'input[name*="password"]', 'button[type="submit"]'];
    const highRiskUrls = ['bank', 'payment', 'checkout', 'login', 'signin'];

    // Check URL first for high risk keywords
    if (params.url && highRiskUrls.some(u => params.url.toLowerCase().includes(u))) {
      return 'high';
    }

    // High risk actions
    const highRiskActions = ['fill', 'type', 'click'];
    if (highRiskActions.includes(action)) {
      // Check selector
      if (params.selector && highRiskSelectors.some(s => params.selector.includes(s))) {
        return 'high';
      }

      return 'medium';
    }

    // Medium risk actions
    const mediumRiskActions = ['navigate', 'select', 'scroll_to'];
    if (mediumRiskActions.includes(action)) {
      return 'medium';
    }

    // Low risk actions (read-only)
    return 'low';
  }
}

// Singleton instance
let approvalGateInstance: ApprovalGate | null = null;

export function getApprovalGate(): ApprovalGate {
  if (!approvalGateInstance) {
    approvalGateInstance = new ApprovalGate();
  }
  return approvalGateInstance;
}
