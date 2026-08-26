import { AgentDefinition } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { configSchema, defaultConfig } from './config-schema';
import { tools } from './composio-tools';

export const newsletterWriterAgent: AgentDefinition = {
  id: 'newsletter-writer',
  name: 'Narrative Lead',
  category: 'Marketing',
  description: 'Crafts compelling newsletters that speak to the Nigerian experience, driving engagement and loyalty.',
  whatItDoes: 'Crafts compelling newsletters that speak to the Nigerian experience, driving engagement and loyalty.',
  icon: '📧',
  systemPrompt: SYSTEM_PROMPT,
  configSchema: configSchema,
  defaultConfig,
  tools: tools,
  composioTools: tools,
};
