import { AgentDefinition } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { configSchema, defaultConfig } from './config-schema';
import { tools } from './composio-tools';

export const meetingSchedulerAgent: AgentDefinition = {
  id: 'meeting-scheduler',
  name: 'Sync Master',
  category: 'Productivity',
  description: 'Coordinates schedules and manages calendar bookings seamlessly.',
  whatItDoes: 'Coordinates schedules and manages calendar bookings seamlessly.',
  icon: '📅',
  systemPrompt: SYSTEM_PROMPT,
  configSchema: configSchema,
  defaultConfig,
  tools: tools,
  composioTools: tools,
};
