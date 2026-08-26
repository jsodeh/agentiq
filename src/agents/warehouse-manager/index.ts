import { AgentDefinition } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { configSchema, defaultConfig } from './config-schema';
import { tools } from './composio-tools';

export const warehouseManagerAgent: AgentDefinition = {
  id: 'warehouse-manager',
  name: 'Warehouse WIZ',
  category: 'Operations',
  description: 'Oversees daily warehouse operations, ensuring safety stock levels and inventory accuracy in Nigerian hubs.',
  whatItDoes: 'Oversees daily warehouse operations, ensuring safety stock levels and inventory accuracy in Nigerian hubs.',
  icon: '🏘️',
  systemPrompt: SYSTEM_PROMPT,
  configSchema: configSchema,
  defaultConfig,
  tools: tools,
  composioTools: tools,
};
