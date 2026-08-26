import { AgentDefinition } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { configSchema, defaultConfig } from './config-schema';
import { tools } from './composio-tools';

export const researcherAgent: AgentDefinition = {
  id: 'researcher',
  name: 'Insight Pro',
  category: 'Research',
  description: 'Deep market research, competitor tracking, and trend analysis.',
  whatItDoes: 'Deep market research, competitor tracking, and trend analysis.',
  icon: '🧪',
  systemPrompt: SYSTEM_PROMPT,
  configSchema: configSchema,
  defaultConfig,
  tools: tools,
  composioTools: tools,
};
