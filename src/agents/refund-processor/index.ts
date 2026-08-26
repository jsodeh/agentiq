import { AgentDefinition } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { configSchema, defaultConfig } from './config-schema';
import { tools } from './composio-tools';

export const refundProcessorAgent: AgentDefinition = {
  id: 'refund-processor',
  name: 'Trust Keeper',
  category: 'Support',
  description: 'Handles refund requests via Paystack/Flutterwave while maintaining customer satisfaction.',
  whatItDoes: 'Handles refund requests via Paystack/Flutterwave while maintaining customer satisfaction.',
  icon: '💸',
  systemPrompt: SYSTEM_PROMPT,
  configSchema: configSchema,
  defaultConfig,
  tools: tools,
  composioTools: tools,
};
