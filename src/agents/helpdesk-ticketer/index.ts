import { AgentDefinition } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { configSchema, defaultConfig } from './config-schema';
import { tools } from './composio-tools';

export const helpdeskTicketerAgent: AgentDefinition = {
  id: 'helpdesk-ticketer',
  name: 'Support Relay',
  category: 'Support',
  description: 'Converts WhatsApp/Email queries into tickets and routes them to the right team members.',
  whatItDoes: 'Converts WhatsApp/Email queries into tickets and routes them to the right team members.',
  icon: '🎟️',
  systemPrompt: SYSTEM_PROMPT,
  configSchema: configSchema,
  defaultConfig,
  tools: tools,
  composioTools: tools,
};
