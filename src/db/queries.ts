import type { Database } from 'better-sqlite3';
import type { User, Agent, Task, Log, Escalation, Conversation, Message } from '../types';

export class DatabaseQueries {
  constructor(private db: Database) {}

  // User queries
  createUser(name: string, email: string): User {
    const result = this.db.prepare(
      'INSERT INTO users (name, email) VALUES (?, ?)'
    ).run(name, email);
    return this.getUserById(result.lastInsertRowid as number)!;
  }

  getUserById(id: number): User | undefined {
    return this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User;
  }

  // Agent queries
  createAgent(userId: number, name: string, type: string, config: string): Agent {
    const result = this.db.prepare(
      'INSERT INTO agents (user_id, name, type, config) VALUES (?, ?, ?, ?)'
    ).run(userId, name, type, config);
    return this.getAgentById(result.lastInsertRowid as number)!;
  }

  getAgentById(id: number): Agent | undefined {
    return this.db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as Agent;
  }

  getAllAgents(): Agent[] {
    return this.db.prepare('SELECT * FROM agents ORDER BY created_at DESC').all() as Agent[];
  }

  updateAgentStatus(id: number, status: Agent['status']): void {
    this.db.prepare('UPDATE agents SET status = ? WHERE id = ?').run(status, id);
  }

  // Task queries
  createTask(agentId: number, description: string): Task {
    const result = this.db.prepare(
      'INSERT INTO tasks (agent_id, description) VALUES (?, ?)'
    ).run(agentId, description);
    return this.getTaskById(result.lastInsertRowid as number)!;
  }

  getTaskById(id: number): Task | undefined {
    return this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task;
  }

  getTasksByAgent(agentId: number): Task[] {
    return this.db.prepare(
      'SELECT * FROM tasks WHERE agent_id = ? ORDER BY created_at DESC'
    ).all(agentId) as Task[];
  }

  updateTaskStatus(id: number, status: Task['status'], result?: string): void {
    if (status === 'completed' || status === 'failed') {
      this.db.prepare(
        'UPDATE tasks SET status = ?, result = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).run(status, result || null, id);
    } else {
      this.db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run(status, id);
    }
  }

  // Log queries
  createLog(agentId: number, level: Log['level'], message: string, metadata?: string): void {
    this.db.prepare(
      'INSERT INTO logs (agent_id, level, message, metadata) VALUES (?, ?, ?, ?)'
    ).run(agentId, level, message, metadata || null);
  }

  getLogsByAgent(agentId: number, limit: number = 100): Log[] {
    return this.db.prepare(
      'SELECT * FROM logs WHERE agent_id = ? ORDER BY created_at DESC LIMIT ?'
    ).all(agentId, limit) as Log[];
  }

  // Escalation queries
  createEscalation(taskId: number, reason: string): Escalation {
    const result = this.db.prepare(
      'INSERT INTO escalations (task_id, reason) VALUES (?, ?)'
    ).run(taskId, reason);
    return this.db.prepare('SELECT * FROM escalations WHERE id = ?')
      .get(result.lastInsertRowid) as Escalation;
  }

  getPendingEscalations(): Escalation[] {
    return this.db.prepare(
      'SELECT * FROM escalations WHERE status = "pending" ORDER BY created_at DESC'
    ).all() as Escalation[];
  }

  resolveEscalation(id: number): void {
    this.db.prepare(
      'UPDATE escalations SET status = "resolved", resolved_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(id);
  }

  // Conversation queries
  createConversation(agentId: number, title: string): Conversation {
    const result = this.db.prepare(
      'INSERT INTO conversations (agent_id, title) VALUES (?, ?)'
    ).run(agentId, title);
    return this.db.prepare('SELECT * FROM conversations WHERE id = ?')
      .get(result.lastInsertRowid) as Conversation;
  }

  getConversationsByAgent(agentId: number): Conversation[] {
    return this.db.prepare(
      'SELECT * FROM conversations WHERE agent_id = ? ORDER BY created_at DESC'
    ).all(agentId) as Conversation[];
  }

  // Message queries
  createMessage(conversationId: number, role: Message['role'], content: string): Message {
    const result = this.db.prepare(
      'INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)'
    ).run(conversationId, role, content);
    return this.db.prepare('SELECT * FROM messages WHERE id = ?')
      .get(result.lastInsertRowid) as Message;
  }

  getMessagesByConversation(conversationId: number): Message[] {
    return this.db.prepare(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'
    ).all(conversationId) as Message[];
  }
}
