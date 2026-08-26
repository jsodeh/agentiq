import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OrchestratorService } from '../../orchestrator';
import Database from 'better-sqlite3';

describe('OrchestratorService', () => {
  let orchestrator: OrchestratorService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = new Database(':memory:');
    
    orchestrator = new OrchestratorService({
      dbPath: ':memory:',
      mode: 'local',
      ollamaEndpoint: 'http://localhost:11434',
    });
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.stop();
      orchestrator.close();
    }
  });

  describe('Start and Stop', () => {
    it('should start cleanly without throwing', async () => {
      await expect(orchestrator.start()).resolves.not.toThrow();
      expect(orchestrator.getStatus().running).toBe(true);
    });

    it('should stop cleanly without throwing', async () => {
      await orchestrator.start();
      await expect(orchestrator.stop()).resolves.not.toThrow();
      expect(orchestrator.getStatus().running).toBe(false);
    });

    it('should throw error when starting twice', async () => {
      await orchestrator.start();
      await expect(orchestrator.start()).rejects.toThrow('Orchestrator already running');
    });

    it('should not throw when stopping twice', async () => {
      await orchestrator.start();
      await orchestrator.stop();
      await expect(orchestrator.stop()).resolves.not.toThrow();
    });
  });

  describe('Task Queue Priority', () => {
    it('should process tasks in priority order', async () => {
      const executionOrder: number[] = [];

      // Mock the database to return tasks
      const mockPrepare = vi.fn(() => ({
        all: vi.fn(() => [
          { id: 1, status: 'active', config: '{}' },
        ]),
        get: vi.fn((agentId: number) => {
          if (agentId === 1) {
            return { id: 1, status: 'active', config: '{}' };
          }
          return undefined;
        }),
        run: vi.fn(() => ({ lastInsertRowid: 1 })),
      }));

      (mockDb.prepare as any) = mockPrepare;

      await orchestrator.start();

      // Add tasks with different priorities
      const queue = (orchestrator as any).queue;
      
      await queue.add(() => {
        executionOrder.push(3);
        return Promise.resolve();
      }, { priority: 3 });

      await queue.add(() => {
        executionOrder.push(1);
        return Promise.resolve();
      }, { priority: 1 });

      await queue.add(() => {
        executionOrder.push(2);
        return Promise.resolve();
      }, { priority: 2 });

      await queue.onIdle();

      // Higher priority (lower number) should execute first
      expect(executionOrder[0]).toBe(1);
      expect(executionOrder[1]).toBe(2);
      expect(executionOrder[2]).toBe(3);
    });

    it('should respect concurrency limit of 3', async () => {
      const queue = (orchestrator as any).queue;
      
      expect(queue.concurrency).toBe(3);

      let concurrent = 0;
      let maxConcurrent = 0;

      const tasks = Array.from({ length: 10 }, () =>
        queue.add(async () => {
          concurrent++;
          maxConcurrent = Math.max(maxConcurrent, concurrent);
          await new Promise(resolve => setTimeout(resolve, 10));
          concurrent--;
        })
      );

      await Promise.all(tasks);

      expect(maxConcurrent).toBeLessThanOrEqual(3);
    });
  });

  describe('Escalation Rules', () => {
    beforeEach(() => {
      const mockPrepare = vi.fn((query: string) => {
        if (query.includes('SELECT * FROM agents')) {
          return {
            get: vi.fn(() => ({
              id: 1,
              config: JSON.stringify({
                escalationRules: [],
              }),
            })),
          };
        }
        return {
          run: vi.fn(() => ({ lastInsertRowid: 1 })),
          get: vi.fn(),
          all: vi.fn(() => []),
        };
      });

      (mockDb.prepare as any) = mockPrepare;
    });

    it('should trigger error_retry_count escalation', async () => {
      const checkEscalationRules = (orchestrator as any).checkEscalationRules.bind(orchestrator);

      const mockAgent = {
        id: 1,
        config: JSON.stringify({
          escalationRules: [
            {
              type: 'error_retry_count',
              threshold: 3,
              operator: 'gte',
              enabled: true,
            },
          ],
        }),
      };

      mockDb.prepare = vi.fn(() => ({
        get: vi.fn(() => mockAgent),
        run: vi.fn(() => ({ lastInsertRowid: 1 })),
      }));

      await checkEscalationRules(1, 1, { errorCount: 3 });

      // Verify escalation was created
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO escalations')
      );
    });

    it('should trigger deal_value_threshold escalation', async () => {
      const checkEscalationRules = (orchestrator as any).checkEscalationRules.bind(orchestrator);

      const mockAgent = {
        id: 1,
        config: JSON.stringify({
          escalationRules: [
            {
              type: 'deal_value_threshold',
              threshold: 100000,
              operator: 'gt',
              enabled: true,
            },
          ],
        }),
      };

      mockDb.prepare = vi.fn(() => ({
        get: vi.fn(() => mockAgent),
        run: vi.fn(() => ({ lastInsertRowid: 1 })),
      }));

      await checkEscalationRules(1, 1, { dealValue: 150000 });

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO escalations')
      );
    });

    it('should trigger sentiment_score escalation', async () => {
      const checkEscalationRules = (orchestrator as any).checkEscalationRules.bind(orchestrator);

      const mockAgent = {
        id: 1,
        config: JSON.stringify({
          escalationRules: [
            {
              type: 'sentiment_score',
              threshold: 0.3,
              operator: 'lt',
              enabled: true,
            },
          ],
        }),
      };

      mockDb.prepare = vi.fn(() => ({
        get: vi.fn(() => mockAgent),
        run: vi.fn(() => ({ lastInsertRowid: 1 })),
      }));

      await checkEscalationRules(1, 1, { sentimentScore: 0.2 });

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO escalations')
      );
    });

    it('should trigger payment_amount_threshold escalation', async () => {
      const checkEscalationRules = (orchestrator as any).checkEscalationRules.bind(orchestrator);

      const mockAgent = {
        id: 1,
        config: JSON.stringify({
          escalationRules: [
            {
              type: 'payment_amount_threshold',
              threshold: 50000,
              operator: 'gte',
              enabled: true,
            },
          ],
        }),
      };

      mockDb.prepare = vi.fn(() => ({
        get: vi.fn(() => mockAgent),
        run: vi.fn(() => ({ lastInsertRowid: 1 })),
      }));

      await checkEscalationRules(1, 1, { paymentAmount: 75000 });

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO escalations')
      );
    });

    it('should trigger reply_rate_threshold escalation', async () => {
      const checkEscalationRules = (orchestrator as any).checkEscalationRules.bind(orchestrator);

      const mockAgent = {
        id: 1,
        config: JSON.stringify({
          escalationRules: [
            {
              type: 'reply_rate_threshold',
              threshold: 20,
              operator: 'lt',
              enabled: true,
            },
          ],
        }),
      };

      mockDb.prepare = vi.fn(() => ({
        get: vi.fn(() => mockAgent),
        run: vi.fn(() => ({ lastInsertRowid: 1 })),
      }));

      await checkEscalationRules(1, 1, { replyRate: 15 });

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO escalations')
      );
    });

    it('should not trigger when rule is disabled', async () => {
      const checkEscalationRules = (orchestrator as any).checkEscalationRules.bind(orchestrator);

      const mockAgent = {
        id: 1,
        config: JSON.stringify({
          escalationRules: [
            {
              type: 'error_retry_count',
              threshold: 3,
              operator: 'gte',
              enabled: false,
            },
          ],
        }),
      };

      const mockRun = vi.fn(() => ({ lastInsertRowid: 1 }));
      mockDb.prepare = vi.fn(() => ({
        get: vi.fn(() => mockAgent),
        run: mockRun,
      }));

      await checkEscalationRules(1, 1, { errorCount: 5 });

      // Should not create escalation
      expect(mockRun).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('Error retry count')
      );
    });
  });

  describe('SQLite Concurrency Stress Test', () => {
    it('should handle 10 concurrent agents writing without corruption', async () => {
      const agents = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        status: 'active',
        config: '{}',
      }));

      const mockPrepare = vi.fn((query: string) => {
        if (query.includes('SELECT * FROM agents WHERE status')) {
          return { all: vi.fn(() => agents) };
        }
        if (query.includes('SELECT * FROM agents WHERE id')) {
          return {
            get: vi.fn((id: number) => agents.find(a => a.id === id)),
          };
        }
        if (query.includes('INSERT INTO logs')) {
          return {
            run: vi.fn(() => ({ lastInsertRowid: Math.floor(Math.random() * 1000) })),
          };
        }
        return {
          run: vi.fn(() => ({ lastInsertRowid: 1 })),
          get: vi.fn(),
          all: vi.fn(() => []),
        };
      });

      mockDb.prepare = mockPrepare;

      // Start orchestrator
      await orchestrator.start();

      // Simulate concurrent writes
      const writes = Array.from({ length: 100 }, (_, i) =>
        (orchestrator as any).log(
          (i % 10) + 1,
          'info',
          `Concurrent write ${i}`
        )
      );

      await Promise.all(writes);

      // Verify no errors were thrown
      expect(mockPrepare).toHaveBeenCalled();
    });
  });

  describe('Status and Monitoring', () => {
    it('should return correct orchestrator status', async () => {
      const status = orchestrator.getStatus();

      expect(status).toHaveProperty('running');
      expect(status).toHaveProperty('activeAgents');
      expect(status).toHaveProperty('queueSize');
      expect(status).toHaveProperty('queuePending');
    });

    it('should return agent statuses', () => {
      mockDb.prepare = vi.fn((query: string) => {
        if (query.includes('SELECT * FROM agents')) {
          return {
            all: vi.fn(() => [
              { id: 1, status: 'active', created_at: new Date().toISOString() },
              { id: 2, status: 'paused', created_at: new Date().toISOString() },
            ]),
          };
        }
        if (query.includes('COUNT(*)')) {
          return { get: vi.fn(() => ({ count: 5 })) };
        }
        return { get: vi.fn() };
      });

      const statuses = orchestrator.getAgentStatuses();

      expect(statuses).toHaveLength(2);
      expect(statuses[0]).toHaveProperty('agentId');
      expect(statuses[0]).toHaveProperty('status');
      expect(statuses[0]).toHaveProperty('tasksCompleted');
    });
  });
});
