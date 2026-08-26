import { AgentDefinition } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { configSchema, defaultConfig } from './config-schema';
import { tools } from './composio-tools';

export const virtualReceptionistAgent: AgentDefinition = {
  id: 'virtual-receptionist',
  name: 'Front Desk AI',
  category: 'Customer Service',
  description: 'Handles initial inquiries, books appointments, and greets clients professionally.',
  whatItDoes: 'Handles initial inquiries, books appointments, and greets clients professionally.',
  icon: '📞',
  systemPrompt: SYSTEM_PROMPT,
  configSchema: configSchema,
  defaultConfig,
  tools: tools,
  composioTools: tools,
};
