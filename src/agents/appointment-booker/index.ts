import { AgentDefinition } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { configSchema, defaultConfig } from './config-schema';
import { tools } from './composio-tools';

export const appointmentBookerAgent: AgentDefinition = {
  id: 'appointment-booker',
  name: 'Calendar Whiz',
  category: 'Sales',
  description: 'Coordinates schedules and books appointments seamlessly across Google Calendar and WhatsApp.',
  whatItDoes: 'Coordinates schedules and books appointments seamlessly across Google Calendar and WhatsApp.',
  icon: '📅',
  systemPrompt: SYSTEM_PROMPT,
  configSchema: configSchema,
  defaultConfig,
  tools: tools,
  composioTools: tools,
};
