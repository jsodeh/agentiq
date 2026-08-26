import { AgentDefinition } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { configSchema, defaultConfig } from './config-schema';
import { tools } from './composio-tools';

export const fleetCoordinatorAgent: AgentDefinition = {
  id: 'fleet-coordinator',
  name: 'Fleet Master',
  category: 'Operations',
  description: 'Coordinates a fleet of dispatch riders and vehicles across Nigerian cities like Lagos and PH.',
  whatItDoes: 'Coordinates a fleet of dispatch riders and vehicles across Nigerian cities like Lagos and PH.',
  icon: '🏍️',
  systemPrompt: SYSTEM_PROMPT,
  configSchema: configSchema,
  defaultConfig,
  tools: tools,
  composioTools: tools,
};
