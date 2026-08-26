import { AgentDefinition } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { configSchema, defaultConfig } from './config-schema';
import { tools } from './composio-tools';

export const brandMonitorAgent: AgentDefinition = {
  id: 'brand-monitor',
  name: 'Brand Sentinel',
  category: 'Marketing',
  description: 'Monitors brand mentions, sentiment, and reputation across Nigerian social media and forums.',
  whatItDoes: 'Monitors brand mentions, sentiment, and reputation across Nigerian social media and forums.',
  icon: '👁️',
  systemPrompt: SYSTEM_PROMPT,
  configSchema: configSchema,
  defaultConfig,
  tools: tools,
  composioTools: tools,
};
