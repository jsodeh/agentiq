import { AgentDefinition } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { configSchema, defaultConfig } from './config-schema';
import { tools } from './composio-tools';

export const disputeResolverAgent: AgentDefinition = {
  id: 'dispute-resolver',
  name: 'Dispute Solver',
  category: 'Support',
  description: 'Handles customer disputes, payment issues, and refunds with a focus on Nigerian payment gateways.',
  whatItDoes: 'Handles customer disputes, payment issues, and refunds with a focus on Nigerian payment gateways.',
  icon: '⚖️',
  systemPrompt: SYSTEM_PROMPT,
  configSchema: configSchema,
  defaultConfig,
  tools: tools,
  composioTools: tools,
};
