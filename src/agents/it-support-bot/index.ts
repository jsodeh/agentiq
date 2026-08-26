import { AgentDefinition } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { configSchema, defaultConfig } from './config-schema';
import { tools } from './composio-tools';

export const itSupportBotAgent: AgentDefinition = {
  id: 'it-support-bot',
  name: 'Tech Aide',
  category: 'Customer Service',
  description: 'Provides technical support, troubleshoots issues, and manages IT tickets.',
  whatItDoes: 'Provides technical support, troubleshoots issues, and manages IT tickets.',
  icon: '🛠️',
  systemPrompt: SYSTEM_PROMPT,
  configSchema: configSchema,
  defaultConfig,
  tools: tools,
  composioTools: tools,
};
