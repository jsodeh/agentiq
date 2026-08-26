import { AgentDefinition } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { configSchema, defaultConfig } from './config-schema';
import { tools } from './composio-tools';

export const sentimentMonitorAgent: AgentDefinition = {
  id: 'sentiment-monitor',
  name: 'Brand Pulse',
  category: 'Marketing',
  description: 'Real-time monitoring of brand sentiment on Twitter (X) and Instagram within the Nigerian tech/business ecosystem.',
  whatItDoes: 'Real-time monitoring of brand sentiment on Twitter (X) and Instagram within the Nigerian tech/business ecosystem.',
  icon: '📊',
  systemPrompt: SYSTEM_PROMPT,
  configSchema: configSchema,
  defaultConfig,
  tools: tools,
  composioTools: tools,
};
