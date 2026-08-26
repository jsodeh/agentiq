import { AgentDefinition } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { configSchema, defaultConfig } from './config-schema';
import { tools } from './composio-tools';

export const salesAnalystAgent: AgentDefinition = {
  id: 'sales-analyst',
  name: 'Sales Strategy Analyst',
  category: 'Sales',
  description: 'Analyzes sales data, identifies trends, and provides actionable insights for growth.',
  whatItDoes: 'Analyzes sales data, identifies trends, and provides actionable insights for growth.',
  icon: '📊',
  systemPrompt: SYSTEM_PROMPT,
  configSchema: configSchema,
  defaultConfig,
  tools: tools,
  composioTools: tools,
};
