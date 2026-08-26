import { AgentDefinition } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { configSchema, defaultConfig } from './config-schema';
import { tools } from './composio-tools';

export const videoScriptGeneratorAgent: AgentDefinition = {
  id: 'video-script-generator',
  name: 'Script Wiz',
  category: 'Marketing',
  description: 'Generates scripts for TikTok, Reels, and YouTube, optimized for Nigerian audience engagement.',
  whatItDoes: 'Generates scripts for TikTok, Reels, and YouTube, optimized for Nigerian audience engagement.',
  icon: '🎬',
  systemPrompt: SYSTEM_PROMPT,
  configSchema: configSchema,
  defaultConfig,
  tools: tools,
  composioTools: tools,
};
