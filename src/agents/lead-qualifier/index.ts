import { AgentDefinition } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { configSchema, defaultConfig } from './config-schema';
import { tools } from './composio-tools';

export const leadQualifierAgent: AgentDefinition = {
  id: 'lead-qualifier',
  name: 'Vetting Pro',
  category: 'Sales',
  description: 'Scores and qualifies leads based on budget, intent, and location before handing off to sales.',
  whatItDoes: 'Scores and qualifies leads based on budget, intent, and location before handing off to sales.',
  icon: '🎯',
  systemPrompt: SYSTEM_PROMPT,
  configSchema: configSchema,
  defaultConfig,
  tools: tools,
  composioTools: tools,
};
