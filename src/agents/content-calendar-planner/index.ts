import { AgentDefinition } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { configSchema, defaultConfig } from './config-schema';
import { tools } from './composio-tools';

export const contentCalendarPlannerAgent: AgentDefinition = {
  id: 'content-calendar-planner',
  name: 'Vibe Curator',
  category: 'Marketing',
  description: 'Plans and schedules engaging content across social media, localized for the Nigerian audience and trends.',
  whatItDoes: 'Plans and schedules engaging content across social media, localized for the Nigerian audience and trends.',
  icon: '🗓️',
  systemPrompt: SYSTEM_PROMPT,
  configSchema: configSchema,
  defaultConfig,
  tools: tools,
  composioTools: tools,
};
