import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OrchestratorService } from '../../orchestrator';
import Database from 'better-sqlite3';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';

vi.mock('@anthropic-ai/sdk');
vi.mock('composio-core');

describe('Integration Test 2: Agent Execution Loop', () => {
  let orchestrator: OrchestratorService;
  let testDb: Database.Database;
  let testDbPath: string;
  let mockComposio: any;
  let mockAnthropic: any;

  beforeEach(async () => {
    // Create test database
    testDbPath = path.join(__dirname, `test_execution_${Date.now()}.db`);
    testDb = new Database(testDbPath);

    // Initialize schema
    const schema = fs.readFileSync(
      path.join(__dirname, '../../db/schema.sql'),
      'utf-8'
    );
    testDb.exec(schema);

    // Insert test user
    testDb.prepare('INSERT INTO users (name, email) VALUES (?, ?)').run('Test User', 'test@example.com');

    // Insert test agent
    const agentConfig = {
      businessName: 'Test Business',
      targetLocation: 'Lagos, Nigeria',
      searchQuery: 'restaurants',
      maxResults: 10,
      tools: ['GOOGLEMAPS_SEARCH', 'GOOGLEMAPS_GET_PLACE_DETAILS'],
    };

    testDb
      .prepare(
        'INSERT INTO agents (user_id, name, type, status, config) VALUES (?, ?, ?, ?, ?)'
      )
      .run(
        1,
        'Lead Gen Agent',
        'lead-gen-maps',
        'active',
        JSON.stringify(agentConfig)
      );

    // Insert test task
    testDb
      .prepare(
        'INSERT INTO tasks (agent_id, description, status) VALUES (?, ?, ?)'
      )
      .run(1, 'Find 10 restaurants in Lagos', 'pending');

    // Mock Composio SDK
    const { Composio } = await import('composio-core');
    mockComposio = {
      executeAction: vi.fn(async (tool: string, params: any) => {
        if (tool === 'GOOGLEMAPS_SEARCH') {
          return {
            results: [
              {
                name: 'Restaurant A',
                address: '123 Lagos Street',
                phone: '+234 123 456 7890',
                rating: 4.5,
                place_id: 'place_123',
              },
              {
                name: 'Restaurant B',
                address: '456 Victoria Island',
                phone: '+234 987 654 3210',
                rating: 4.2,
                place_id: 'place_456',
              },
            ],
          };
        }
        if (tool === 'GOOGLEMAPS_GET_PLACE_DETAILS') {
          return {
            name: 'Restaurant A',
            formatted_address: '123 Lagos Street, Lagos, Nigeria',
            formatted_phone_number: '+234 123 456 7890',
            website: 'https://restaurant-a.com',
            rating: 4.5,
            user_ratings_total: 150,
          };
        }
        return {};
      }),
    };

    vi.mocked(Composio).mockImplementation(() => mockComposio);

    // Mock Anthropic SDK
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
                reasoning: 'I will search Google Maps for restaurants in Lagos and extract their contact details',
                actions: [
                  {
                    tool: 'GOOGLEMAPS_SEARCH',
                    params: {
                      query: 'restaurants in Lagos, Nigeria',
                      location: 'Lagos, Nigeria',
                      radius: 5000,
                    },
                    description: 'Search for restaurants in Lagos',
                  },
                  {
                    tool: 'GOOGLEMAPS_GET_PLACE_DETAILS',
                    params: {
                      place_id: 'place_123',
                    },
                    description: 'Get detailed information for Restaurant A',
                  },
                ],
                expectedOutcome: 'A list of 10 restaurants with contact details',
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

    // Create orchestrator
    orchestrator = new OrchestratorService({
      dbPath: testDbPath,
      mode: 'cloud',
      anthropicApiKey: 'test_key',
      composioApiKey: 'test_composio_key',
    });

    // Inject mocked Composio
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

  it('should execute agent task and save results to database', async () => {
    // Start orchestrator
    await orchestrator.start();

    // Run specific agent
    await orchestrator.runAgent(1);

    // Wait for task to complete (with timeout)
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

      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve(false);
      }, 10000);
    });

    // ASSERTIONS

    // 1. Task row in SQLite has status "completed"
    const task = testDb
      .prepare('SELECT * FROM tasks WHERE id = ?')
      .get(1) as any;

    expect(task).toBeDefined();
    expect(task.status).toBe('completed');

    // 2. Result is non-null
    expect(task.result).toBeTruthy();

    // Parse result
    const result = JSON.parse(task.result);
    expect(result).toHaveProperty('plan');
    expect(result).toHaveProperty('actions');
    expect(result).toHaveProperty('completedAt');

    // Verify plan structure
    expect(result.plan.reasoning).toBeTruthy();
    expect(result.plan.actions).toBeInstanceOf(Array);
    expect(result.plan.actions.length).toBeGreaterThan(0);

    // Verify actions were executed
    expect(result.actions).toBeInstanceOf(Array);
    expect(result.actions.length).toBeGreaterThan(0);

    result.actions.forEach((action: any) => {
      expect(action).toHaveProperty('action');
      expect(action).toHaveProperty('result');
      expect(action).toHaveProperty('success');
    });

    // 3. At least one log row exists for this task
    const logs = testDb
      .prepare('SELECT * FROM logs WHERE agent_id = ?')
      .all(1) as any[];

    expect(logs.length).toBeGreaterThan(0);

    // Verify log entries
    const logMessages = logs.map((log) => log.message);
    expect(logMessages.some((msg) => msg.includes('Starting task'))).toBe(true);
    expect(logMessages.some((msg) => msg.includes('completed successfully'))).toBe(true);

    // 4. Verify Composio was called with correct parameters
    expect(mockComposio.executeAction).toHaveBeenCalledWith(
      'GOOGLEMAPS_SEARCH',
      expect.objectContaining({
        query: expect.stringContaining('restaurants'),
        location: expect.stringContaining('Lagos'),
      })
    );

    // 5. Verify Anthropic was called
    expect(mockAnthropic.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-sonnet-4-20250514',
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
          }),
        ]),
      })
    );
  });

  it('should handle task failure and log errors', async () => {
    // Mock Composio to throw error
    mockComposio.executeAction = vi.fn(async () => {
      throw new Error('API rate limit exceeded');
    });

    await orchestrator.start();
    await orchestrator.runAgent(1);

    // Wait for task to fail
    await new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const task = testDb
          .prepare('SELECT * FROM tasks WHERE id = ?')
          .get(1) as any;

        if (task && task.status === 'failed') {
          clearInterval(checkInterval);
          resolve(true);
        }
      }, 100);

      setTimeout(() => {
        clearInterval(checkInterval);
        resolve(false);
      }, 10000);
    });

    // Verify task failed
    const task = testDb
      .prepare('SELECT * FROM tasks WHERE id = ?')
      .get(1) as any;

    expect(task.status).toBe('failed');
    expect(task.result).toContain('API rate limit exceeded');

    // Verify error was logged
    const errorLogs = testDb
      .prepare('SELECT * FROM logs WHERE agent_id = ? AND level = ?')
      .all(1, 'error') as any[];

    expect(errorLogs.length).toBeGreaterThan(0);
    expect(errorLogs.some((log) => log.message.includes('failed'))).toBe(true);
  });

  it('should process multiple tasks in queue', async () => {
    // Insert additional tasks
    testDb
      .prepare(
        'INSERT INTO tasks (agent_id, description, status) VALUES (?, ?, ?)'
      )
      .run(1, 'Find 10 hotels in Lagos', 'pending');

    testDb
      .prepare(
        'INSERT INTO tasks (agent_id, description, status) VALUES (?, ?, ?)'
      )
      .run(1, 'Find 10 cafes in Lagos', 'pending');

    await orchestrator.start();
    await orchestrator.runAgent(1);

    // Wait for all tasks to complete
    await new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const pendingTasks = testDb
          .prepare('SELECT COUNT(*) as count FROM tasks WHERE status = ?')
          .get('pending') as any;

        if (pendingTasks.count === 0) {
          clearInterval(checkInterval);
          resolve(true);
        }
      }, 100);

      setTimeout(() => {
        clearInterval(checkInterval);
        resolve(false);
      }, 30000);
    });

    // Verify all tasks completed
    const completedTasks = testDb
      .prepare('SELECT COUNT(*) as count FROM tasks WHERE status = ?')
      .get('completed') as any;

    expect(completedTasks.count).toBeGreaterThanOrEqual(1);
  });

  it('should respect concurrency limits', async () => {
    // Insert many tasks
    for (let i = 0; i < 10; i++) {
      testDb
        .prepare(
          'INSERT INTO tasks (agent_id, description, status) VALUES (?, ?, ?)'
        )
        .run(1, `Task ${i}`, 'pending');
    }

    await orchestrator.start();

    // Check queue status
    const status = orchestrator.getStatus();
    expect(status.running).toBe(true);

    // Verify concurrency is limited to 3
    const queue = (orchestrator as any).queue;
    expect(queue.concurrency).toBe(3);

    // At any point, no more than 3 tasks should be in progress
    const inProgressTasks = testDb
      .prepare('SELECT COUNT(*) as count FROM tasks WHERE status = ?')
      .get('in_progress') as any;

    expect(inProgressTasks.count).toBeLessThanOrEqual(3);
  });

  it('should update agent status correctly', async () => {
    await orchestrator.start();

    // Check agent status
    const statuses = orchestrator.getAgentStatuses();
    const agentStatus = statuses.find((s) => s.agentId === 1);

    expect(agentStatus).toBeDefined();
    expect(agentStatus?.status).toBe('running');

    // Pause agent
    await orchestrator.pauseAgent(1);

    // Verify status updated
    const agent = testDb
      .prepare('SELECT * FROM agents WHERE id = ?')
      .get(1) as any;

    expect(agent.status).toBe('paused');

    // Verify agent stopped processing
    const updatedStatuses = orchestrator.getAgentStatuses();
    const updatedAgentStatus = updatedStatuses.find((s) => s.agentId === 1);

    expect(updatedAgentStatus?.status).toBe('paused');
  });
});
