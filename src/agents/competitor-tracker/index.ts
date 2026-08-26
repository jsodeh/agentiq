import { AgentDefinition } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { configSchema, defaultConfig } from './config-schema';
import { tools } from './composio-tools';

export const competitorTrackerAgent: AgentDefinition = {
  id: 'competitor-tracker',
  name: 'Market Watcher',
  category: 'Marketing',
  description: 'Monitors competitor pricing, product launches, and social media activity in the Nigerian market.',
  whatItDoes: 'Monitors competitor pricing, product launches, and social media activity in the Nigerian market.',
  icon: '🕵️',
  systemPrompt: SYSTEM_PROMPT,
  configSchema: configSchema,
  defaultConfig,
  tools: tools,
  composioTools: tools,
};
