import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApprovalGate } from '../../computer-use/approval-gate';
import type { ComputerUseAction } from '../../computer-use/approval-gate';
import { emit, listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/event');
vi.mock('@tauri-apps/api/core');

describe('ApprovalGate', () => {
  let approvalGate: ApprovalGate;

  beforeEach(() => {
    approvalGate = new ApprovalGate();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await approvalGate.clearAllPendingActions();
  });

  describe('Approval Request', () => {
    it('should emit computer_use_pending event before executing', async () => {
      const mockEmit = vi.mocked(emit);
      mockEmit.mockResolvedValue();

      const action: ComputerUseAction = {
        id: 'action_123',
        agentId: 1,
        sessionId: 'session_123',
        action: 'click',
        description: 'Click submit button',
        params: { selector: 'button[type="submit"]' },
        risk: 'medium',
        timestamp: Date.now(),
      };

      // Start approval request (don't await, it will wait for approval)
      const approvalPromise = approvalGate.requestApproval(action);

      // Wait a bit for the event to be emitted
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockEmit).toHaveBeenCalledWith(
        'computer_use_pending',
        expect.objectContaining({
          action: expect.stringContaining('action_123'),
        })
      );

      // Approve to complete the promise
      (approvalGate as any).handleApproval('action_123', true);
      await approvalPromise;
    });

    it('should auto-approve when auto-approve is enabled', async () => {
      await approvalGate.setAutoApprove(true);

      const action: ComputerUseAction = {
        id: 'action_123',
        agentId: 1,
        sessionId: 'session_123',
        action: 'navigate',
        description: 'Navigate to URL',
        params: { url: 'https://example.com' },
        risk: 'low',
        timestamp: Date.now(),
      };

      const result = await approvalGate.requestApproval(action);

      expect(result).toBe(true);
      expect(invoke).toHaveBeenCalledWith(
        'log_approval_decision',
        expect.objectContaining({
          decision: expect.stringContaining('Auto-approved'),
        })
      );
    });

    it('should wait for manual approval when auto-approve is disabled', async () => {
      await approvalGate.setAutoApprove(false);

      const action: ComputerUseAction = {
        id: 'action_123',
        agentId: 1,
        sessionId: 'session_123',
        action: 'fill',
        description: 'Fill form field',
        params: { selector: 'input[name="email"]', value: 'test@example.com' },
        risk: 'medium',
        timestamp: Date.now(),
      };

      const approvalPromise = approvalGate.requestApproval(action);

      // Simulate approval after delay
      setTimeout(() => {
        (approvalGate as any).handleApproval('action_123', true, 'Approved by user');
      }, 50);

      const result = await approvalPromise;

      expect(result).toBe(true);
    });

    it('should return false when rejected', async () => {
      await approvalGate.setAutoApprove(false);

      const action: ComputerUseAction = {
        id: 'action_123',
        agentId: 1,
        sessionId: 'session_123',
        action: 'fill',
        description: 'Fill password field',
        params: { selector: 'input[type="password"]', value: 'secret' },
        risk: 'high',
        timestamp: Date.now(),
      };

      const approvalPromise = approvalGate.requestApproval(action);

      // Simulate rejection
      setTimeout(() => {
        (approvalGate as any).handleApproval('action_123', false, 'Too risky');
      }, 50);

      const result = await approvalPromise;

      expect(result).toBe(false);
    });
  });

  describe('Timeout Handling', () => {
    it('should auto-reject after 120s timeout', async () => {
      // Set shorter timeout for testing
      approvalGate.setApprovalTimeout(100); // 100ms

      const action: ComputerUseAction = {
        id: 'action_123',
        agentId: 1,
        sessionId: 'session_123',
        action: 'click',
        description: 'Click button',
        params: { selector: 'button' },
        risk: 'medium',
        timestamp: Date.now(),
      };

      const mockEmit = vi.mocked(emit);
      mockEmit.mockResolvedValue();

      const approvalPromise = approvalGate.requestApproval(action);

      // Wait for timeout
      const result = await approvalPromise;

      expect(result).toBe(false);
      expect(mockEmit).toHaveBeenCalledWith(
        'computer_use_timeout',
        expect.objectContaining({
          actionId: 'action_123',
        })
      );
    });

    it('should log timeout reason', async () => {
      approvalGate.setApprovalTimeout(100);

      const action: ComputerUseAction = {
        id: 'action_123',
        agentId: 1,
        sessionId: 'session_123',
        action: 'click',
        description: 'Click button',
        params: { selector: 'button' },
        risk: 'medium',
        timestamp: Date.now(),
      };

      const mockInvoke = vi.mocked(invoke);
      mockInvoke.mockResolvedValue('{}');

      await approvalGate.requestApproval(action);

      expect(mockInvoke).toHaveBeenCalledWith(
        'log_approval_decision',
        expect.objectContaining({
          decision: expect.stringContaining('Timeout'),
        })
      );
    });

    it('should clear timeout when approved before timeout', async () => {
      approvalGate.setApprovalTimeout(1000); // 1 second

      const action: ComputerUseAction = {
        id: 'action_123',
        agentId: 1,
        sessionId: 'session_123',
        action: 'click',
        description: 'Click button',
        params: { selector: 'button' },
        risk: 'medium',
        timestamp: Date.now(),
      };

      const approvalPromise = approvalGate.requestApproval(action);

      // Approve quickly
      setTimeout(() => {
        (approvalGate as any).handleApproval('action_123', true);
      }, 50);

      const result = await approvalPromise;

      expect(result).toBe(true);

      // Wait to ensure timeout doesn't fire
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should not have emitted timeout event
      expect(emit).not.toHaveBeenCalledWith(
        'computer_use_timeout',
        expect.anything()
      );
    });
  });

  describe('Action Logging', () => {
    it('should log approved action', async () => {
      const mockInvoke = vi.mocked(invoke);
      mockInvoke.mockResolvedValue('{}');

      await approvalGate.setAutoApprove(true);

      const action: ComputerUseAction = {
        id: 'action_123',
        agentId: 1,
        sessionId: 'session_123',
        action: 'navigate',
        description: 'Navigate to URL',
        params: { url: 'https://example.com' },
        risk: 'low',
        timestamp: Date.now(),
      };

      await approvalGate.requestApproval(action);

      expect(mockInvoke).toHaveBeenCalledWith(
        'log_approval_decision',
        expect.objectContaining({
          decision: expect.stringContaining('action_123'),
        })
      );
    });

    it('should log rejected action', async () => {
      const mockInvoke = vi.mocked(invoke);
      mockInvoke.mockResolvedValue('{}');

      const action: ComputerUseAction = {
        id: 'action_123',
        agentId: 1,
        sessionId: 'session_123',
        action: 'fill',
        description: 'Fill password',
        params: { selector: 'input[type="password"]', value: 'secret' },
        risk: 'high',
        timestamp: Date.now(),
      };

      const approvalPromise = approvalGate.requestApproval(action);

      setTimeout(() => {
        (approvalGate as any).handleApproval('action_123', false, 'User rejected');
      }, 50);

      await approvalPromise;

      expect(mockInvoke).toHaveBeenCalledWith(
        'log_approval_decision',
        expect.objectContaining({
          decision: expect.stringContaining('action_123'),
        })
      );
    });
  });

  describe('Pending Actions Management', () => {
    it('should track pending actions', async () => {
      const action: ComputerUseAction = {
        id: 'action_123',
        agentId: 1,
        sessionId: 'session_123',
        action: 'click',
        description: 'Click button',
        params: { selector: 'button' },
        risk: 'medium',
        timestamp: Date.now(),
      };

      const approvalPromise = approvalGate.requestApproval(action);

      const pending = await approvalGate.getPendingActions();

      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe('action_123');

      // Approve to complete
      (approvalGate as any).handleApproval('action_123', true);
      await approvalPromise;
    });

    it('should clear pending action after approval', async () => {
      const action: ComputerUseAction = {
        id: 'action_123',
        agentId: 1,
        sessionId: 'session_123',
        action: 'click',
        description: 'Click button',
        params: { selector: 'button' },
        risk: 'medium',
        timestamp: Date.now(),
      };

      const approvalPromise = approvalGate.requestApproval(action);

      setTimeout(() => {
        (approvalGate as any).handleApproval('action_123', true);
      }, 50);

      await approvalPromise;

      const pending = await approvalGate.getPendingActions();
      expect(pending).toHaveLength(0);
    });

    it('should clear all pending actions', async () => {
      const actions: ComputerUseAction[] = [
        {
          id: 'action_1',
          agentId: 1,
          sessionId: 'session_123',
          action: 'click',
          description: 'Click button 1',
          params: { selector: 'button1' },
          risk: 'low',
          timestamp: Date.now(),
        },
        {
          id: 'action_2',
          agentId: 1,
          sessionId: 'session_123',
          action: 'click',
          description: 'Click button 2',
          params: { selector: 'button2' },
          risk: 'low',
          timestamp: Date.now(),
        },
      ];

      actions.forEach(action => approvalGate.requestApproval(action));

      await new Promise(resolve => setTimeout(resolve, 10));

      let pending = await approvalGate.getPendingActions();
      expect(pending.length).toBeGreaterThan(0);

      await approvalGate.clearAllPendingActions();

      pending = await approvalGate.getPendingActions();
      expect(pending).toHaveLength(0);
    });
  });

  describe('Risk Assessment', () => {
    it('should assess high risk for password fields', () => {
      const risk = ApprovalGate.assessRisk('fill', {
        selector: 'input[type="password"]',
        value: 'secret',
      });

      expect(risk).toBe('high');
    });

    it('should assess high risk for submit buttons', () => {
      const risk = ApprovalGate.assessRisk('click', {
        selector: 'button[type="submit"]',
      });

      expect(risk).toBe('high');
    });

    it('should assess high risk for payment URLs', () => {
      const risk = ApprovalGate.assessRisk('navigate', {
        url: 'https://example.com/checkout',
      });

      expect(risk).toBe('high');
    });

    it('should assess medium risk for form fills', () => {
      const risk = ApprovalGate.assessRisk('fill', {
        selector: 'input[name="email"]',
        value: 'test@example.com',
      });

      expect(risk).toBe('medium');
    });

    it('should assess low risk for read-only actions', () => {
      const risk = ApprovalGate.assessRisk('screenshot', {});

      expect(risk).toBe('low');
    });
  });

  describe('Approval Statistics', () => {
    it('should calculate approval stats', async () => {
      const mockHistory = [
        { actionId: '1', approved: true, timestamp: Date.now() },
        { actionId: '2', approved: false, timestamp: Date.now() },
        { actionId: '3', approved: true, reason: 'Auto-approved', timestamp: Date.now() },
        { actionId: '4', approved: false, reason: 'Timeout - no response', timestamp: Date.now() },
      ];

      vi.mocked(invoke).mockResolvedValue(JSON.stringify(mockHistory));

      const stats = await approvalGate.getApprovalStats();

      expect(stats.totalActions).toBe(4);
      expect(stats.approved).toBe(1);
      expect(stats.rejected).toBe(1);
      expect(stats.timedOut).toBe(1);
      expect(stats.autoApproved).toBe(1);
      expect(stats.approvalRate).toBe(50); // (1 + 1) / 4 * 100
    });
  });
});
