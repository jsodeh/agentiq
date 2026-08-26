import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OrchestratorService } from '../../orchestrator';
import Database from 'better-sqlite3';
import Anthropic from '@anthropic-ai/sdk';
import { emit } from '@tauri-apps/api/event';
import fs from 'fs';
import path from 'path';

vi.mock('@anthropic-ai/sdk');
vi.mock('composio-core');
vi.mock('@tauri-apps/api/event');

describe('Integration Test 3: Escalation End-to-End', () => {
  let orchestrator: OrchestratorService;
  let testDb: Database.Database;
  let testDbPath: string;
  let mockComposio: any;
  let mockAnthropic: any;

  beforeEach(async () => {
    // Create test database
    testDbPath = path.join(__dirname, `test_escalation_${Date.now()}.db`);
    testDb = new Database(testDbPath);

    // Initialize schema
    const schema = fs.readFileSync(
      path.join(__dirname, '../../db/schema.sql'),
      'utf-8'
    );
    testDb.exec(schema);

    // Insert test user
    testDb.prepare('INSERT INTO users (name, email) VALUES (?, ?)').run('Test User', 'test@example.com');

    // Insert test agent with deal_value_threshold escalation rule
    const agentConfig = {
      businessName: 'Test Business',
      targetLocation: 'Lagos, Nigeria',
      tools: ['GOOGLEMAPS_SEARCH'],
      escalationRules: [
        {
          type: 'deal_value_threshold',
          threshold: 10000,
          operator: 'gt',
          enabled: true,
        },
      ],
    };

    testDb
      .prepare(
        'INSERT INTO agents (user_id, name, type, status, config) VALUES (?, ?, ?, ?, ?)'
      )
      .run(
        1,
        'Sales Agent',
        'cold-outreach',
        'active',
        JSON.stringify(agentConfig)
      );

    // Insert test task
    testDb
      .prepare(
        'INSERT INTO tasks (agent_id, description, status) VALUES (?, ?, ?)'
      )
      .run(1, 'Process high-value deal', 'pending');

    // Mock Composio SDK
    const { Composio } = await import('composio-core');
    mockComposio = {
      executeAction: vi.fn(async (tool: string) => {
        return {
          success: true,
          data: { message: 'Action executed' },
        };
      }),
    };

    vi.mocked(Composio).mockImplementation(() => mockComposio);

    // Mock Anthropic SDK to return action plan with high deal value
    mockAnthropic = {
      messages: {
        create: vi.fn(async () => ({
          id: 'msg_123',
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                reasoning: 'This is a high-value deal worth ₦50,000 that requires owner approval',
                actions: [
                  {
                    tool: 'SEND_EMAIL',
                    params: {
                      to: 'client@example.com',
                      subject: 'Proposal for ₦50,000 deal',
                      body: 'We would like to propose...',
                    },
                    description: 'Send proposal email',
                  },
                ],
                expectedOutcome: 'Email sent and deal recorded',
                dealValue: 50000, // This should trigger escalation
              }),
            },
          ],
          model: 'claude-sonnet-4-20250514',
          stop_reason: 'end_turn',
          usage: {
            input_tokens: 100,
            output_tokens: 200,
          },
        })),
      },
    };

    vi.mocked(Anthropic).mockImplementation(() => mockAnthropic);

    // Mock Tauri emit
    vi.mocked(emit).mockResolvedValue();

    // Create orchestrator
    orchestrator = new OrchestratorService({
      dbPath: testDbPath,
      mode: 'cloud',
      anthropicApiKey: 'test_key',
      composioApiKey: 'test_composio_key',
    });

    // Inject mocked dependencies
    (orchestrator as any).composio = mockComposio;
    (orchestrator as any).anthropic = mockAnthropic;
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.stop();
      orchestrator.close();
    }
    if (testDb && testDb.open) {
      testDb.close();
    }
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    vi.clearAllMocks();
  });

  it('should trigger escalation for high-value deal and pause task', async () => {
    await orchestrator.start();

    // Execute the private method directly for testing
    const executeAgentTask = (orchestrator as any).executeAgentTask.bind(orchestrator);
    await executeAgentTask(1);

    // Wait a bit for async operations
    await new Promise((resolve) => setTimeout(resolve, 500));

    // ASSERTIONS

    // 1. Agent task is paused in SQLite
    const task = testDb
      .prepare('SELECT * FROM tasks WHERE id = ?')
      .get(1) as any;

    expect(task).toBeDefined();
    expect(task.status).toBe('pending'); // Task should be reset to pending

    // 2. Escalation row inserted with correct reason
    const escalations = testDb
      .prepare('SELECT * FROM escalations WHERE task_id = ?')
      .all(1) as any[];

    expect(escalations.length).toBeGreaterThan(0);

    const escalation = escalations[0];
    expect(escalation.reason).toContain('50000');
    expect(escalation.reason).toContain('threshold');
    expect(escalation.status).toBe('pending');

    // 3. Tauri emit("escalation", ...) was called with correct payload
    expect(emit).toHaveBeenCalledWith(
      'escalation',
      expect.objectContaining({
        escalationId: expect.any(Number),
        agentId: 1,
        taskId: 1,
        reason: expect.stringContaining('50000'),
        timestamp: expect.any(String),
      })
    );

    // 4. Verify warning log was created
    const logs = testDb
      .prepare('SELECT * FROM logs WHERE agent_id = ? AND level = ?')
      .all(1, 'warning') as any[];

    expect(logs.length).toBeGreaterThan(0);
    expect(logs.some((log) => log.message.includes('Escalation created'))).toBe(true);
  });

  it('should resume task after escalation is approved', async () => {
    await orchestrator.start();

    // Trigger escalation
    const executeAgentTask = (orchestrator as any).executeAgentTask.bind(orchestrator);
    await executeAgentTask(1);

    await new Promise((resolve) => setTimeout(resolve, 500));

    // Get escalation ID
    const escalation = testDb
      .prepare('SELECT * FROM escalations WHERE task_id = ?')
      .get(1) as any;

    expect(escalation).toBeDefined();

    // Resolve escalation (approve)
    testDb
      .prepare('UPDATE escalations SET status = ?, resolved_at = ? WHERE id = ?')
      .run('resolved', new Date().toISOString(), escalation.id);

    // Update task status back to pending so it can be processed
    testDb
      .prepare('UPDATE tasks SET status = ? WHERE id = ?')
      .run('pending', 1);

    // Run agent again
    await orchestrator.runAgent(1);

    // Wait for task to complete
    await new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const task = testDb
          .prepare('SELECT * FROM tasks WHERE id = ?')
          .get(1) as any;

        if (task && task.status === 'completed') {
          clearInterval(checkInterval);
          resolve(true);
        }
      }, 100);

      setTimeout(() => {
        clearInterval(checkInterval);
        resolve(false);
      }, 10000);
    });

    // Verify task completed
    const task = testDb
      .prepare('SELECT * FROM tasks WHERE id = ?')
      .get(1) as any;

    expect(task.status).toBe('completed');
    expect(task.result).toBeTruthy();

    // Verify escalation is resolved
    const resolvedEscalation = testDb
      .prepare('SELECT * FROM escalations WHERE id = ?')
      .get(escalation.id) as any;

    expect(resolvedEscalation.status).toBe('resolved');
    expect(resolvedEscalation.resolved_at).toBeTruthy();
  });

  it('should not trigger escalation when deal value is below threshold', async () => {
    // Update mock to return low deal value
    mockAnthropic.messages.create = vi.fn(async () => ({
      id: 'msg_123',
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            reasoning: 'This is a low-value deal worth ₦5,000',
            actions: [
              {
                tool: 'SEND_EMAIL',
                params: {
                  to: 'client@example.com',
                  subject: 'Proposal for ₦5,000 deal',
                },
                description: 'Send proposal email',
              },
            ],
            expectedOutcome: 'Email sent',
            dealValue: 5000, // Below threshold of 10,000
          }),
        },
      ],
      model: 'claude-sonnet-4-20250514',
      stop_reason: 'end_turn',
      usage: {
        input_tokens: 100,
        output_tokens: 200,
      },
    }));

    await orchestrator.start();

    const executeAgentTask = (orchestrator as any).executeAgentTask.bind(orchestrator);
    await executeAgentTask(1);

    await new Promise((resolve) => setTimeout(resolve, 500));

    // Verify no escalation was created
    const escalations = testDb
      .prepare('SELECT * FROM escalations WHERE task_id = ?')
      .all(1) as any[];

    expect(escalations.length).toBe(0);

    // Verify task completed normally
    const task = testDb
      .prepare('SELECT * FROM tasks WHERE id = ?')
      .get(1) as any;

    expect(task.status).toBe('completed');
  });

  it('should handle multiple escalation rules', async () => {
    // Update agent config with multiple rules
    const agentConfig = {
      businessName: 'Test Business',
      tools: ['SEND_EMAIL'],
      escalationRules: [
        {
          type: 'deal_value_threshold',
          threshold: 10000,
          operator: 'gt',
          enabled: true,
        },
        {
          type: 'sentiment_score',
          threshold: 0.3,
          operator: 'lt',
          enabled: true,
        },
      ],
    };

    testDb
      .prepare('UPDATE agents SET config = ? WHERE id = ?')
      .run(JSON.stringify(agentConfig), 1);

    // Mock response with both conditions met
    mockAnthropic.messages.create = vi.fn(async () => ({
      id: 'msg_123',
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            reasoning: 'High-value deal with negative sentiment',
            actions: [
              {
                tool: 'SEND_EMAIL',
                params: {},
                description: 'Send email',
              },
            ],
            expectedOutcome: 'Email sent',
            dealValue: 50000, // Triggers first rule
            sentimentScore: 0.2, // Triggers second rule
          }),
        },
      ],
      model: 'claude-sonnet-4-20250514',
      stop_reason: 'end_turn',
      usage: {
        input_tokens: 100,
        output_tokens: 200,
      },
    }));

    await orchestrator.start();

    const executeAgentTask = (orchestrator as any).executeAgentTask.bind(orchestrator);
    await executeAgentTask(1);

    await new Promise((resolve) => setTimeout(resolve, 500));

    // Verify multiple escalations were created
    const escalations = testDb
      .prepare('SELECT * FROM escalations WHERE task_id = ?')
      .all(1) as any[];

    expect(escalations.length).toBe(2);

    // Verify reasons are different
    const reasons = escalations.map((e: any) => e.reason);
    expect(reasons.some((r) => r.includes('deal value') || r.includes('50000'))).toBe(true);
    expect(reasons.some((r) => r.includes('sentiment') || r.includes('0.2'))).toBe(true);
  });

  it('should not trigger when escalation rule is disabled', async () => {
    // Update agent config with disabled rule
    const agentConfig = {
      businessName: 'Test Business',
      tools: ['SEND_EMAIL'],
      escalationRules: [
        {
          type: 'deal_value_threshold',
          threshold: 10000,
          operator: 'gt',
          enabled: false, // Disabled
        },
      ],
    };

    testDb
      .prepare('UPDATE agents SET config = ? WHERE id = ?')
      .run(JSON.stringify(agentConfig), 1);

    await orchestrator.start();

    const executeAgentTask = (orchestrator as any).executeAgentTask.bind(orchestrator);
    await executeAgentTask(1);

    await new Promise((resolve) => setTimeout(resolve, 500));

    // Verify no escalation was created
    const escalations = testDb
      .prepare('SELECT * FROM escalations WHERE task_id = ?')
      .all(1) as any[];

    expect(escalations.length).toBe(0);
  });

  it('should test all escalation rule operators', async () => {
    const testCases = [
      { operator: 'gt', value: 15000, threshold: 10000, shouldEscalate: true },
      { operator: 'lt', value: 5000, threshold: 10000, shouldEscalate: true },
      { operator: 'eq', value: 10000, threshold: 10000, shouldEscalate: true },
      { operator: 'gte', value: 10000, threshold: 10000, shouldEscalate: true },
      { operator: 'lte', value: 10000, threshold: 10000, shouldEscalate: true },
      { operator: 'gt', value: 5000, threshold: 10000, shouldEscalate: false },
    ];

    for (const testCase of testCases) {
      // Clear previous escalations
      testDb.prepare('DELETE FROM escalations').run();

      // Update agent config
      const agentConfig = {
        businessName: 'Test Business',
        tools: ['SEND_EMAIL'],
        escalationRules: [
          {
            type: 'deal_value_threshold',
            threshold: testCase.threshold,
            operator: testCase.operator,
            enabled: true,
          },
        ],
      };

      testDb
        .prepare('UPDATE agents SET config = ? WHERE id = ?')
        .run(JSON.stringify(agentConfig), 1);

      // Mock response
      mockAnthropic.messages.create = vi.fn(async () => ({
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              reasoning: 'Test',
              actions: [{ tool: 'SEND_EMAIL', params: {}, description: 'Test' }],
              expectedOutcome: 'Test',
              dealValue: testCase.value,
            }),
          },
        ],
        model: 'claude-sonnet-4-20250514',
        stop_reason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 200 },
      }));

      // Reset task
      testDb.prepare('UPDATE tasks SET status = ? WHERE id = ?').run('pending', 1);

      const executeAgentTask = (orchestrator as any).executeAgentTask.bind(orchestrator);
      await executeAgentTask(1);

      await new Promise((resolve) => setTimeout(resolve, 300));

      // Verify escalation
      const escalations = testDb
        .prepare('SELECT * FROM escalations WHERE task_id = ?')
        .all(1) as any[];

      if (testCase.shouldEscalate) {
        expect(escalations.length).toBeGreaterThan(0);
      } else {
        expect(escalations.length).toBe(0);
      }
    }
  });
});
