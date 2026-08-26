import { AgentDefinition } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { configSchema, defaultConfig } from './config-schema';
import { tools } from './composio-tools';

export const supplyChainOptimizerAgent: AgentDefinition = {
  id: 'supply-chain-optimizer',
  name: 'Logistics Guru',
  category: 'Operations',
  description: 'Optimizes supply chain routes, tracks shipments across Nigeria, and manages inventory levels with local context.',
  whatItDoes: 'Optimizes supply chain routes, tracks shipments across Nigeria, and manages inventory levels with local context.',
  icon: '🚛',
  systemPrompt: SYSTEM_PROMPT,
  configSchema: configSchema,
  defaultConfig,
  tools: tools,
  composioTools: tools,
};
