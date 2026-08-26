import { AgentDefinition } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { configSchema, defaultConfig } from './config-schema';
import { tools } from './composio-tools';

export const projectManagerAiAgent: AgentDefinition = {
  id: 'project-manager-ai',
  name: 'Project Pilot',
  category: 'Operations',
  description: 'Oversees project timelines, assigns tasks, and ensures team alignment.',
  whatItDoes: 'Oversees project timelines, assigns tasks, and ensures team alignment.',
  icon: '🚀',
  systemPrompt: SYSTEM_PROMPT,
  configSchema: configSchema,
  defaultConfig,
  tools: tools,
  composioTools: tools,
};
