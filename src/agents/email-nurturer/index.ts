import { AgentDefinition } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { configSchema, defaultConfig } from './config-schema';
import { tools } from './composio-tools';

export const emailNurturerAgent: AgentDefinition = {
  id: 'email-nurturer',
  name: 'Email Nurture Specialist',
  category: 'Marketing',
  description: 'Maintains lead interest through automated, value-driven email sequences.',
  whatItDoes: 'Maintains lead interest through automated, value-driven email sequences.',
  icon: '📧',
  systemPrompt: SYSTEM_PROMPT,
  configSchema: configSchema,
  defaultConfig,
  tools: tools,
  composioTools: tools,
};
