import { AgentDefinition } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { configSchema, defaultConfig } from './config-schema';
import { tools } from './composio-tools';

export const expenseTrackerAgent: AgentDefinition = {
  id: 'expense-tracker',
  name: 'Naira Watcher',
  category: 'Finance',
  description: 'Tracks business expenses, manages petty cash, and accounts for Naira volatility.',
  whatItDoes: 'Tracks business expenses, manages petty cash, and accounts for Naira volatility.',
  icon: '💸',
  systemPrompt: SYSTEM_PROMPT,
  configSchema: configSchema,
  defaultConfig,
  tools: tools,
  composioTools: tools,
};
