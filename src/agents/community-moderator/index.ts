import { AgentDefinition } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { configSchema, defaultConfig } from './config-schema';
import { tools } from './composio-tools';

export const communityModeratorAgent: AgentDefinition = {
  id: 'community-moderator',
  name: 'Comm Guard',
  category: 'Operations',
  description: 'Monitors and moderates online communities, ensuring a safe and productive environment.',
  whatItDoes: 'Monitors and moderates online communities, ensuring a safe and productive environment.',
  icon: '💬',
  systemPrompt: SYSTEM_PROMPT,
  configSchema: configSchema,
  defaultConfig,
  tools: tools,
  composioTools: tools,
};
