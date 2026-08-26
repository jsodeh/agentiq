import Anthropic from '@anthropic-ai/sdk';
import Database from 'better-sqlite3';
import PQueue from 'p-queue';
import { z } from 'zod';
import type { Agent, Task, Log, Escalation } from '../types';

// Zod schemas for response validation
const ActionSchema = z.object({
  tool: z.string(),
  params: z.record(z.any()),
  description: z.string().optional(),
});

const PlanSchema = z.object({
  reasoning: z.string(),
  actions: z.array(ActionSchema),
  expectedOutcome: z.string().optional(),
});

// Escalation rule schema
const EscalationRuleSchema = z.object({
  type: z.enum(['deal_value_threshold', 'reply_rate_threshold', 'sentiment_score', 'payment_amount_threshold', 'error_retry_count']),
  threshold: z.number(),
  operator: z.enum(['gt', 'lt', 'eq', 'gte', 'lte']),
  enabled: z.boolean().default(true),
});

interface OrchestratorConfig {
  dbPath: string;
  anthropicApiKey?: string;
  ollamaEndpoint?: string;
  mode: 'local' | 'cloud';
  composioApiKey?: string;
}

interface AgentStatus {
  agentId: number;
  status: 'running' | 'paused' | 'stopped';
  currentTask?: number;
  tasksCompleted: number;
  lastActivity: string;
}

interface LogFilter {
  agentId?: number;
  level?: 'info' | 'warning' | 'error';
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export class OrchestratorService {
  private db: Database.Database;
  private anthropic?: Anthropic;
  private queue: PQueue;
  private config: OrchestratorConfig;
  private running: boolean = false;
  private agentIntervals: Map<number, NodeJS.Timeout> = new Map();
  private composio: any;

  constructor(config: OrchestratorConfig) {
    this.config = config;
    this.db = new Database(config.dbPath);
    this.db.pragma('journal_mode = WAL');
    
    // Initialize priority queue with concurrency 3
    this.queue = new PQueue({ concurrency: 3 });

    // Initialize Anthropic if cloud mode
    if (config.mode === 'cloud' && config.anthropicApiKey) {
      this.anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
    }

    // Initialize Composio
    if (config.composioApiKey) {
      this.initComposio(config.composioApiKey);
    }
  }

  private async initComposio(apiKey: string): Promise<void> {
    try {
      const composioModule = await import('composio-core');
      const ComposioClass = (composioModule as any).Composio || (composioModule as any).default;
      this.composio = new ComposioClass({ apiKey });
    } catch (error) {
      console.error('Failed to initialize Composio:', error);
    }
  }

  /**
   * Start the orchestrator service
   */
  async start(): Promise<void> {
    if (this.running) {
      throw new Error('Orchestrator already running');
    }

    this.running = true;
    this.log(0, 'info', 'Orchestrator started');

    // Start all active agents
    const activeAgents = this.db
      .prepare('SELECT * FROM agents WHERE status = ?')
      .all('active') as Agent[];

    for (const agent of activeAgents) {
      await this.runAgent(agent.id);
    }
  }

  /**
   * Stop the orchestrator service
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.running = false;

    // Stop all agent intervals
    for (const [agentId, interval] of this.agentIntervals.entries()) {
      clearInterval(interval);
      this.agentIntervals.delete(agentId);
    }

    // Wait for queue to finish
    await this.queue.onIdle();

    this.log(0, 'info', 'Orchestrator stopped');
  }

  /**
   * Run a specific agent
   */
  async runAgent(agentId: number): Promise<void> {
    // Update agent status
    this.db.prepare('UPDATE agents SET status = ? WHERE id = ?').run('active', agentId);

    // Clear existing interval if any
    if (this.agentIntervals.has(agentId)) {
      clearInterval(this.agentIntervals.get(agentId)!);
    }

    // Start agent execution loop
    const interval = setInterval(() => {
      this.queue.add(() => this.executeAgentTask(agentId), { priority: 1 });
    }, 10000); // Check for tasks every 10 seconds

    this.agentIntervals.set(agentId, interval);
    this.log(agentId, 'info', 'Agent started');

    // Execute immediately
    await this.queue.add(() => this.executeAgentTask(agentId), { priority: 1 });
  }

  /**
   * Pause a specific agent
   */
  async pauseAgent(agentId: number): Promise<void> {
    // Update agent status
    this.db.prepare('UPDATE agents SET status = ? WHERE id = ?').run('paused', agentId);

    // Clear interval
    if (this.agentIntervals.has(agentId)) {
      clearInterval(this.agentIntervals.get(agentId)!);
      this.agentIntervals.delete(agentId);
    }

    this.log(agentId, 'info', 'Agent paused');
  }

  /**
   * Execute a single task for an agent
   */
  private async executeAgentTask(agentId: number): Promise<void> {
    try {
      // 1. Load agent config from SQLite
      const agent = this.db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId) as Agent | undefined;
      
      if (!agent || agent.status !== 'active') {
        return;
      }

      const config = JSON.parse(agent.config || '{}');

      // Get pending task
      const task = this.db
        .prepare('SELECT * FROM tasks WHERE agent_id = ? AND status = ? ORDER BY created_at ASC LIMIT 1')
        .get(agentId, 'pending') as Task | undefined;

      if (!task) {
        return; // No pending tasks
      }

      // Update task status
      this.db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run('in_progress', task.id);
      this.log(agentId, 'info', `Starting task ${task.id}: ${task.description}`);

      // 2. Call Composio to fetch fresh data
      let contextData: any = {};
      if (this.composio && config.tools) {
        try {
          for (const tool of config.tools) {
            const data = await this.composio.executeAction(tool, {});
            contextData[tool] = data;
          }
        } catch (error) {
          this.log(agentId, 'warning', `Failed to fetch context data: ${error}`);
        }
      }

      // 3. Build messages array with agent system prompt + data
      const systemPrompt = config.systemPrompt || 'You are a helpful AI assistant.';
      const contextMessage = Object.keys(contextData).length > 0
        ? `\n\nContext data:\n${JSON.stringify(contextData, null, 2)}`
        : '';

      const messages = [
        {
          role: 'user' as const,
          content: `${task.description}${contextMessage}\n\nProvide your response as a JSON object with this structure:
{
  "reasoning": "your thought process",
  "actions": [
    {
      "tool": "tool_name",
      "params": { "key": "value" },
      "description": "what this action does"
    }
  ],
  "expectedOutcome": "what you expect to achieve"
}`
        }
      ];

      // 4. Call Anthropic SDK or Ollama
      let responseText: string;
      
      if (this.config.mode === 'cloud' && this.anthropic) {
        const response = await this.anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: systemPrompt,
          messages,
        });

        responseText = response.content[0].type === 'text' ? response.content[0].text : '';
      } else {
        // Call Ollama
        responseText = await this.callOllama(systemPrompt, messages[0].content);
      }

      // 5. Parse JSON response with Zod schema
      let plan: z.infer<typeof PlanSchema>;
      try {
        // Extract JSON from response (handle markdown code blocks)
        const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || responseText.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : responseText;
        const parsed = JSON.parse(jsonStr);
        plan = PlanSchema.parse(parsed);
      } catch (error) {
        this.log(agentId, 'error', `Failed to parse response: ${error}`);
        this.db.prepare('UPDATE tasks SET status = ?, result = ? WHERE id = ?')
          .run('failed', `Parse error: ${error}`, task.id);
        
        // Check error retry escalation
        await this.checkEscalationRules(agentId, task.id, { errorCount: 1 });
        return;
      }

      this.log(agentId, 'info', `Plan: ${plan.reasoning}`);

      // 6. Execute each action in the plan
      const actionResults: any[] = [];
      for (const action of plan.actions) {
        try {
          this.log(agentId, 'info', `Executing action: ${action.tool}`);
          
          if (this.composio) {
            const result = await this.composio.executeAction(action.tool, action.params);
            actionResults.push({ action: action.tool, result, success: true });
            this.log(agentId, 'info', `Action ${action.tool} completed`);
          } else {
            actionResults.push({ action: action.tool, result: 'Composio not configured', success: false });
          }
        } catch (error) {
          this.log(agentId, 'error', `Action ${action.tool} failed: ${error}`);
          actionResults.push({ action: action.tool, error: String(error), success: false });
        }
      }

      // 7. Write result and log to SQLite
      const finalResult = {
        plan: plan,
        actions: actionResults,
        completedAt: new Date().toISOString(),
      };

      this.db.prepare('UPDATE tasks SET status = ?, result = ?, completed_at = ? WHERE id = ?')
        .run('completed', JSON.stringify(finalResult), new Date().toISOString(), task.id);

      this.log(agentId, 'info', `Task ${task.id} completed successfully`);

      // 8. Check escalation rules
      await this.checkEscalationRules(agentId, task.id, {
        actionResults,
        plan,
      });

    } catch (error) {
      this.log(agentId, 'error', `Task execution failed: ${error}`);
      
      // Update task as failed
      const task = this.db
        .prepare('SELECT * FROM tasks WHERE agent_id = ? AND status = ? LIMIT 1')
        .get(agentId, 'in_progress') as Task | undefined;
      
      if (task) {
        this.db.prepare('UPDATE tasks SET status = ?, result = ? WHERE id = ?')
          .run('failed', String(error), task.id);
      }
    }
  }

  /**
   * Call Ollama for local mode
   */
  private async callOllama(systemPrompt: string, userMessage: string): Promise<string> {
    const endpoint = this.config.ollamaEndpoint || 'http://localhost:11434';
    const model = localStorage.getItem('selected_model') || 'llama3.2:3b';

    const response = await fetch(`${endpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: `${systemPrompt}\n\nUser: ${userMessage}\n\nAssistant:`,
        stream: false,
      }),
    });

    const data = (await response.json()) as any;
    return data.response || '';
  }

  /**
   * Check escalation rules and trigger if needed
   */
  private async checkEscalationRules(
    agentId: number,
    taskId: number,
    context: any
  ): Promise<void> {
    const agent = this.db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId) as any;
    if (!agent) return;
    const config = JSON.parse(agent.config || '{}');
    const rules = config.escalationRules || [];

    for (const rule of rules) {
      try {
        const parsedRule = EscalationRuleSchema.parse(rule);
        
        if (!parsedRule.enabled) continue;

        let shouldEscalate = false;
        let reason = '';

        switch (parsedRule.type) {
          case 'error_retry_count':
            if (context.errorCount && this.evaluateOperator(context.errorCount, parsedRule.operator, parsedRule.threshold)) {
              shouldEscalate = true;
              reason = `Error retry count (${context.errorCount}) exceeded threshold (${parsedRule.threshold})`;
            }
            break;

          case 'deal_value_threshold':
            if (context.dealValue && this.evaluateOperator(context.dealValue, parsedRule.operator, parsedRule.threshold)) {
              shouldEscalate = true;
              reason = `Deal value ($${context.dealValue}) requires approval (threshold: $${parsedRule.threshold})`;
            }
            break;

          case 'sentiment_score':
            if (context.sentimentScore && this.evaluateOperator(context.sentimentScore, parsedRule.operator, parsedRule.threshold)) {
              shouldEscalate = true;
              reason = `Sentiment score (${context.sentimentScore}) below threshold (${parsedRule.threshold})`;
            }
            break;

          case 'payment_amount_threshold':
            if (context.paymentAmount && this.evaluateOperator(context.paymentAmount, parsedRule.operator, parsedRule.threshold)) {
              shouldEscalate = true;
              reason = `Payment amount ($${context.paymentAmount}) requires approval (threshold: $${parsedRule.threshold})`;
            }
            break;

          case 'reply_rate_threshold':
            if (context.replyRate && this.evaluateOperator(context.replyRate, parsedRule.operator, parsedRule.threshold)) {
              shouldEscalate = true;
              reason = `Reply rate (${context.replyRate}%) below threshold (${parsedRule.threshold}%)`;
            }
            break;
        }

        if (shouldEscalate) {
          await this.createEscalation(agentId, taskId, reason);
        }
      } catch (error) {
        this.log(agentId, 'warning', `Failed to evaluate escalation rule: ${error}`);
      }
    }
  }

  /**
   * Evaluate operator for escalation rules
   */
  private evaluateOperator(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case 'gt': return value > threshold;
      case 'lt': return value < threshold;
      case 'eq': return value === threshold;
      case 'gte': return value >= threshold;
      case 'lte': return value <= threshold;
      default: return false;
    }
  }

  /**
   * Create an escalation record
   */
  private async createEscalation(agentId: number, taskId: number, reason: string): Promise<void> {
    // Pause agent task
    this.db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run('pending', taskId);

    // Insert escalation record
    const result = this.db.prepare(
      'INSERT INTO escalations (task_id, reason, status) VALUES (?, ?, ?)'
    ).run(taskId, reason, 'pending');

    const escalationId = result.lastInsertRowid;

    this.log(agentId, 'warning', `Escalation created: ${reason}`);

    // Emit event to frontend via Tauri (if available)
    try {
      if (typeof window !== 'undefined' && (window as any).__TAURI__) {
        const { emit } = await import('@tauri-apps/api/event');
        await emit('escalation', {
          escalationId,
          agentId,
          taskId,
          reason,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Failed to emit escalation event:', error);
    }

    // TODO: Send push notification via FCM
    await this.sendPushNotification(agentId, reason);
  }

  /**
   * Send push notification via FCM
   */
  private async sendPushNotification(agentId: number, message: string): Promise<void> {
    // Placeholder for FCM integration
    console.log(`[FCM] Notification for agent ${agentId}: ${message}`);
  }

  /**
   * Get orchestrator status
   */
  getStatus(): { running: boolean; activeAgents: number; queueSize: number; queuePending: number } {
    return {
      running: this.running,
      activeAgents: this.agentIntervals.size,
      queueSize: this.queue.size,
      queuePending: this.queue.pending,
    };
  }

  /**
   * Get agent statuses
   */
  getAgentStatuses(): AgentStatus[] {
    const agents = this.db.prepare('SELECT * FROM agents').all() as Agent[];
    
    return agents.map(agent => {
      const tasksCompleted = this.db
        .prepare('SELECT COUNT(*) as count FROM tasks WHERE agent_id = ? AND status = ?')
        .get(agent.id, 'completed') as { count: number };

      const currentTask = this.db
        .prepare('SELECT id FROM tasks WHERE agent_id = ? AND status = ? LIMIT 1')
        .get(agent.id, 'in_progress') as { id: number } | undefined;

      return {
        agentId: agent.id,
        status: agent.status as 'running' | 'paused' | 'stopped',
        currentTask: currentTask?.id,
        tasksCompleted: tasksCompleted.count,
        lastActivity: agent.created_at,
      };
    });
  }

  /**
   * Get logs with filters
   */
  getLogs(filters: LogFilter = {}): Log[] {
    let query = 'SELECT * FROM logs WHERE 1=1';
    const params: any[] = [];

    if (filters.agentId) {
      query += ' AND agent_id = ?';
      params.push(filters.agentId);
    }

    if (filters.level) {
      query += ' AND level = ?';
      params.push(filters.level);
    }

    if (filters.startDate) {
      query += ' AND created_at >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ' AND created_at <= ?';
      params.push(filters.endDate);
    }

    query += ' ORDER BY created_at DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    return this.db.prepare(query).all(...params) as Log[];
  }

  /**
   * Get escalations
   */
  getEscalations(status?: 'pending' | 'resolved' | 'dismissed'): Escalation[] {
    let query = 'SELECT * FROM escalations';
    const params: any[] = [];

    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    return this.db.prepare(query).all(...params) as Escalation[];
  }

  /**
   * Log a message
   */
  private log(agentId: number, level: 'info' | 'warning' | 'error', message: string): void {
    this.db.prepare('INSERT INTO logs (agent_id, level, message) VALUES (?, ?, ?)')
      .run(agentId, level, message);
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}
