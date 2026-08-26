import { AgentDefinition } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { configSchema, defaultConfig } from './config-schema';
import { tools } from './composio-tools';

export const loyaltyManagerAgent: AgentDefinition = {
  id: 'loyalty-manager',
  name: 'Fan Base',
  category: 'Marketing',
  description: 'Manages reward points and special offers for repeat customers in the Nigerian retail space.',
  whatItDoes: 'Manages reward points and special offers for repeat customers in the Nigerian retail space.',
  icon: '💎',
  systemPrompt: SYSTEM_PROMPT,
  configSchema: configSchema,
  defaultConfig,
  tools: tools,
  composioTools: tools,
};
