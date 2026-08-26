import { AgentDefinition } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { configSchema, defaultConfig } from './config-schema';
import { tools } from './composio-tools';

export const shippingTrackerAgent: AgentDefinition = {
  id: 'shipping-tracker',
  name: 'Logistics Link',
  category: 'Operations',
  description: 'Tracks shipments across major Nigerian and international carriers, keeping customers updated.',
  whatItDoes: 'Tracks shipments across major Nigerian and international carriers, keeping customers updated.',
  icon: '🚚',
  systemPrompt: SYSTEM_PROMPT,
  configSchema: configSchema,
  defaultConfig,
  tools: tools,
  composioTools: tools,
};
