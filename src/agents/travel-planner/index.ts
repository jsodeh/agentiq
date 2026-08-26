import { AgentDefinition } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { configSchema, defaultConfig } from './config-schema';
import { tools } from './composio-tools';

export const travelPlannerAgent: AgentDefinition = {
  id: 'travel-planner',
  name: 'Globe Trotter',
  category: 'Operations',
  description: 'Plans business travel, manages bookings via Wakanow, and checks visa requirements.',
  whatItDoes: 'Plans business travel, manages bookings via Wakanow, and checks visa requirements.',
  icon: '✈️',
  systemPrompt: SYSTEM_PROMPT,
  configSchema: configSchema,
  defaultConfig,
  tools: tools,
  composioTools: tools,
};
