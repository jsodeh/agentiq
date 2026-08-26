import { AgentDefinition } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { configSchema, defaultConfig } from './config-schema';
import { tools } from './composio-tools';

export const dealCloserAgent: AgentDefinition = {
  id: 'deal-closer',
  name: 'The Closer',
  category: 'Sales',
  description: 'Finalizes negotiations, handles contracts, and secures payments to close the deal.',
  whatItDoes: 'Finalizes negotiations, handles contracts, and secures payments to close the deal.',
  icon: '🤝',
  systemPrompt: SYSTEM_PROMPT,
  configSchema: configSchema,
  defaultConfig,
  tools: tools,
  composioTools: tools,
};
