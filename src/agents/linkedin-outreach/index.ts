import { AgentDefinition } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { configSchema, defaultConfig } from './config-schema';
import { tools } from './composio-tools';

export const linkedinOutreachAgent: AgentDefinition = {
  id: 'linkedin-outreach',
  name: 'LinkedIn Networker',
  category: 'Sales',
  description: 'Grows B2B networks and initiates professional conversations on LinkedIn.',
  whatItDoes: 'Grows B2B networks and initiates professional conversations on LinkedIn.',
  icon: '💼',
  systemPrompt: SYSTEM_PROMPT,
  configSchema: configSchema,
  defaultConfig,
  tools: tools,
  composioTools: tools,
};
