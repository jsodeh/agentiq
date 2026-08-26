import { AgentDefinition } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { configSchema, defaultConfig } from './config-schema';
import { tools } from './composio-tools';

export const adCampaignManagerAgent: AgentDefinition = {
  id: 'ad-campaign-manager',
  name: 'Ad Maestro',
  category: 'Marketing',
  description: 'Manages digital ad campaigns across Meta and Google, optimizing for the Nigerian market and budget constraints.',
  whatItDoes: 'Manages digital ad campaigns across Meta and Google, optimizing for the Nigerian market and budget constraints.',
  icon: '📣',
  systemPrompt: SYSTEM_PROMPT,
  configSchema: configSchema,
  defaultConfig,
  tools: tools,
  composioTools: tools,
};
