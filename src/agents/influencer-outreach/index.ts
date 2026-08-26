import { AgentDefinition } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { configSchema, defaultConfig } from './config-schema';
import { tools } from './composio-tools';

export const influencerOutreachAgent: AgentDefinition = {
  id: 'influencer-outreach',
  name: 'Influence Scout',
  category: 'Marketing',
  description: 'Identifies and connects with Nigerian influencers to build authentic brand partnerships.',
  whatItDoes: 'Identifies and connects with Nigerian influencers to build authentic brand partnerships.',
  icon: '🤳',
  systemPrompt: SYSTEM_PROMPT,
  configSchema: configSchema,
  defaultConfig,
  tools: tools,
  composioTools: tools,
};
