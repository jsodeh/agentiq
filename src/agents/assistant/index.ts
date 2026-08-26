import { AgentDefinition } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { configSchema, defaultConfig } from './config-schema';
import { tools } from './composio-tools';

export const assistantAgent: AgentDefinition = {
  id: 'assistant',
  name: 'Executive Assistant',
  category: 'Productivity',
  description: 'Handles scheduling, email management, and daily task coordination.',
  whatItDoes: 'Handles scheduling, email management, and daily task coordination.',
  icon: '📅',
  systemPrompt: SYSTEM_PROMPT,
  configSchema: configSchema,
  defaultConfig,
  tools: tools,
  composioTools: tools,
};
