export interface User {
  id: number;
  name: string;
  email: string;
  created_at: string;
}

export interface Agent {
  id: number;
  user_id: number;
  name: string;
  type: string;
  status: 'active' | 'paused' | 'stopped';
  config: string;
  created_at: string;
}

export interface Task {
  id: number;
  agent_id: number;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: string;
  created_at: string;
  completed_at?: string;
}

export interface Log {
  id: number;
  agent_id: number;
  level: 'info' | 'warning' | 'error';
  message: string;
  metadata?: string;
  created_at: string;
}

export interface Escalation {
  id: number;
  task_id: number;
  reason: string;
  status: 'pending' | 'resolved' | 'dismissed';
  created_at: string;
  resolved_at?: string;
}

export interface Conversation {
  id: number;
  agent_id: number;
  title: string;
  created_at: string;
}

export interface Message {
  id: number;
  conversation_id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}
