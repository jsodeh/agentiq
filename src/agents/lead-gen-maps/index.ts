import { AgentDefinition } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { configSchema, defaultConfig } from './config-schema';
import { tools } from './composio-tools';

export const leadGenMapsAgent: AgentDefinition = {
  id: 'lead-gen-maps',
  name: 'Maps Lead Generator',
  category: 'Sales',
  description: 'Finds local Nigerian businesses via Google Maps and extracts contact info.',
  whatItDoes: 'Finds local Nigerian businesses via Google Maps and extracts contact info.',
  icon: '📍',
  systemPrompt: SYSTEM_PROMPT,
  configSchema: configSchema,
  defaultConfig,
  tools: tools,
  composioTools: tools,
};
