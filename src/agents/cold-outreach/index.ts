import { AgentDefinition } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { configSchema, defaultConfig } from './config-schema';
import { tools } from './composio-tools';

export const coldOutreachAgent: AgentDefinition = {
  id: 'cold-outreach',
  name: 'Cold Outreach Pro',
  category: 'Sales',
  description: 'Initiates first contact with leads via Email and WhatsApp with a Nigerian flair.',
  whatItDoes: 'Initiates first contact with leads via Email and WhatsApp with a Nigerian flair.',
  icon: '📞',
  systemPrompt: SYSTEM_PROMPT,
  configSchema: configSchema,
  defaultConfig,
  tools: tools,
  composioTools: tools,
};
