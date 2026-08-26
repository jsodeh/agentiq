import { AgentDefinition } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { configSchema, defaultConfig } from './config-schema';
import { tools } from './composio-tools';

export const orderHandlerAgent: AgentDefinition = {
  id: 'order-handler',
  name: 'Order Fulfillment Maestro',
  category: 'Operations',
  description: 'Manages order processing, payment verification, and customer notifications.',
  whatItDoes: 'Manages order processing, payment verification, and customer notifications.',
  icon: '📦',
  systemPrompt: SYSTEM_PROMPT,
  configSchema: configSchema,
  defaultConfig,
  tools: tools,
  composioTools: tools,
};
