import { AgentDefinition } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { configSchema, defaultConfig } from './config-schema';
import { tools } from './composio-tools';

export const procurementAgent: AgentDefinition = {
  id: 'procurement-agent',
  name: 'Sourcing Ace',
  category: 'Operations',
  description: 'Handles local and international procurement, manages vendor relationships, and tracks FX impact on purchases.',
  whatItDoes: 'Handles local and international procurement, manages vendor relationships, and tracks FX impact on purchases.',
  icon: '📦',
  systemPrompt: SYSTEM_PROMPT,
  configSchema: configSchema,
  defaultConfig,
  tools: tools,
  composioTools: tools,
};
