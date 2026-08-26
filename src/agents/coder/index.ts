import { AgentDefinition } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { configSchema, defaultConfig } from './config-schema';
import { tools } from './composio-tools';

export const coderAgent: AgentDefinition = {
  id: 'coder',
  name: 'Code Master',
  category: 'Coding',
  description: 'Expert developer for building apps, fixing bugs, and managing repositories.',
  whatItDoes: 'Expert developer for building apps, fixing bugs, and managing repositories.',
  icon: '💻',
  systemPrompt: SYSTEM_PROMPT,
  configSchema: configSchema,
  defaultConfig,
  tools: tools,
  composioTools: tools,
};
