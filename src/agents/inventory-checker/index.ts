import { AgentDefinition } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { configSchema, defaultConfig } from './config-schema';
import { tools } from './composio-tools';

export const inventoryCheckerAgent: AgentDefinition = {
  id: 'inventory-checker',
  name: 'Stock Sentinel',
  category: 'Operations',
  description: 'Monitors inventory levels across multiple Nigerian warehouses and alerts when stock is low.',
  whatItDoes: 'Monitors inventory levels across multiple Nigerian warehouses and alerts when stock is low.',
  icon: '📦',
  systemPrompt: SYSTEM_PROMPT,
  configSchema: configSchema,
  defaultConfig,
  tools: tools,
  composioTools: tools,
};
