import { AgentDefinition } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { configSchema, defaultConfig } from './config-schema';
import { tools } from './composio-tools';

export const socialMediaManagerAgent: AgentDefinition = {
  id: 'social-media-manager',
  name: 'Social Media Buzzmaker',
  category: 'Marketing',
  description: 'Creates and schedules engaging content across social platforms with a local touch.',
  whatItDoes: 'Creates and schedules engaging content across social platforms with a local touch.',
  icon: '📱',
  systemPrompt: SYSTEM_PROMPT,
  configSchema: configSchema,
  defaultConfig,
  tools: tools,
  composioTools: tools,
};
