-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Agents table
CREATE TABLE IF NOT EXISTS agents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'stopped' CHECK(status IN ('active', 'paused', 'stopped')),
  config TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id INTEGER NOT NULL,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed', 'failed')),
  result TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- Logs table
CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id INTEGER NOT NULL,
  level TEXT NOT NULL CHECK(level IN ('info', 'warning', 'error')),
  message TEXT NOT NULL,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- Escalations table
CREATE TABLE IF NOT EXISTS escalations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'resolved', 'dismissed')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_agent_id ON tasks(agent_id);
CREATE INDEX IF NOT EXISTS idx_logs_agent_id ON logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_escalations_task_id ON escalations(task_id);
CREATE INDEX IF NOT EXISTS idx_conversations_agent_id ON conversations(agent_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);

-- Computer Use Tables

-- Browser actions log
CREATE TABLE IF NOT EXISTS browser_actions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  agent_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  selector TEXT,
  value TEXT,
  url TEXT,
  timestamp INTEGER NOT NULL,
  screenshot_path TEXT,
  success BOOLEAN NOT NULL,
  error TEXT,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- Session recordings
CREATE TABLE IF NOT EXISTS session_recordings (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  agent_id INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  duration INTEGER NOT NULL,
  start_time INTEGER NOT NULL,
  end_time INTEGER NOT NULL,
  starred BOOLEAN DEFAULT 0,
  thumbnail TEXT,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- Approval decisions
CREATE TABLE IF NOT EXISTS approval_decisions (
  id TEXT PRIMARY KEY,
  action_id TEXT NOT NULL,
  agent_id INTEGER NOT NULL,
  approved BOOLEAN NOT NULL,
  reason TEXT,
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- Verification captures
CREATE TABLE IF NOT EXISTS verification_captures (
  id TEXT PRIMARY KEY,
  action_id TEXT NOT NULL,
  agent_id INTEGER NOT NULL,
  capture_path TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- Computer Use Indexes
CREATE INDEX IF NOT EXISTS idx_browser_actions_session ON browser_actions(session_id);
CREATE INDEX IF NOT EXISTS idx_browser_actions_agent ON browser_actions(agent_id);
CREATE INDEX IF NOT EXISTS idx_browser_actions_timestamp ON browser_actions(timestamp);
CREATE INDEX IF NOT EXISTS idx_session_recordings_agent ON session_recordings(agent_id);
CREATE INDEX IF NOT EXISTS idx_session_recordings_starred ON session_recordings(starred);
CREATE INDEX IF NOT EXISTS idx_approval_decisions_agent ON approval_decisions(agent_id);
CREATE INDEX IF NOT EXISTS idx_approval_decisions_timestamp ON approval_decisions(timestamp);
CREATE INDEX IF NOT EXISTS idx_verification_captures_action ON verification_captures(action_id);
CREATE INDEX IF NOT EXISTS idx_verification_captures_agent ON verification_captures(agent_id);

-- Billing Tables

-- Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  plan_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK(provider IN ('paystack', 'flutterwave')),
  provider_subscription_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('active', 'cancelled', 'expired', 'past_due')),
  current_period_start INTEGER NOT NULL,
  current_period_end INTEGER NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Usage tracking
CREATE TABLE IF NOT EXISTS usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  plan_id TEXT NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  tokens_limit INTEGER NOT NULL,
  agents_active INTEGER DEFAULT 0,
  agents_limit INTEGER NOT NULL,
  period_start INTEGER NOT NULL,
  period_end INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  subscription_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'NGN',
  status TEXT NOT NULL CHECK(status IN ('paid', 'pending', 'failed')),
  paid_at INTEGER,
  invoice_url TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
);

-- Agent budgets
CREATE TABLE IF NOT EXISTS agent_budgets (
  agent_id INTEGER PRIMARY KEY,
  daily_token_limit INTEGER NOT NULL,
  tokens_used_today INTEGER DEFAULT 0,
  last_reset_at INTEGER NOT NULL,
  budget_exhausted BOOLEAN DEFAULT 0,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- Token usage log
CREATE TABLE IF NOT EXISTS token_usage_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id INTEGER NOT NULL,
  tokens_used INTEGER NOT NULL,
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- Pending subscriptions (before payment confirmation)
CREATE TABLE IF NOT EXISTS pending_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  plan_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  reference TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Billing Indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_provider_id ON subscriptions(provider_subscription_id);
CREATE INDEX IF NOT EXISTS idx_usage_user ON usage(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_period ON usage(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_subscription ON invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_token_usage_agent ON token_usage_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_timestamp ON token_usage_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_pending_subscriptions_reference ON pending_subscriptions(reference);

-- Knowledge Base Table for Business RAG
CREATE TABLE IF NOT EXISTS knowledge_base (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  tags TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- System Shared Memory Table for Long-term Context & Facts
CREATE TABLE IF NOT EXISTS system_memory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL DEFAULT 1,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge_base(category);
CREATE INDEX IF NOT EXISTS idx_memory_key ON system_memory(key);

-- Profiles Table for Multi-Profile / Multi-Tenant System
CREATE TABLE IF NOT EXISTS profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL DEFAULT 1,
  name TEXT NOT NULL,
  avatar_url TEXT,
  tier TEXT DEFAULT 'base' CHECK(tier IN ('base', 'pro', 'agency')),
  max_accounts_per_platform INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Inbox Messages Table
CREATE TABLE IF NOT EXISTS inbox_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT DEFAULT 'info' CHECK(type IN ('info', 'approval', 'alert', 'task_done')),
  read BOOLEAN DEFAULT 0,
  action_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

-- Team Members Table
CREATE TABLE IF NOT EXISTS team_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL DEFAULT 1,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'member' CHECK(role IN ('owner', 'admin', 'member', 'viewer')),
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_profiles_user ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_inbox_profile ON inbox_messages(profile_id);
CREATE INDEX IF NOT EXISTS idx_inbox_read ON inbox_messages(read);
CREATE INDEX IF NOT EXISTS idx_team_profile ON team_members(profile_id);

-- Runtime executions table for state serialization & session recovery
CREATE TABLE IF NOT EXISTS runtime_executions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL,
  status TEXT NOT NULL,
  turns_used INTEGER NOT NULL DEFAULT 0,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  pending_tool_name TEXT,
  pending_tool_params TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_runtime_executions_conv ON runtime_executions(conversation_id);

