import { AgentDefinition } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { configSchema, defaultConfig } from './config-schema';
import { tools } from './composio-tools';

export const referralManagerAgent: AgentDefinition = {
  id: 'referral-manager',
  name: 'Network Grower',
  category: 'Marketing',
  description: 'Automates referral programs and tracks word-of-mouth growth across WhatsApp groups.',
  whatItDoes: 'Automates referral programs and tracks word-of-mouth growth across WhatsApp groups.',
  icon: '🤝',
  systemPrompt: SYSTEM_PROMPT,
  configSchema: configSchema,
  defaultConfig,
  tools: tools,
  composioTools: tools,
};
