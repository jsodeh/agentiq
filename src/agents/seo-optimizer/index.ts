import { AgentDefinition } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { configSchema, defaultConfig } from './config-schema';
import { tools } from './composio-tools';

export const seoOptimizerAgent: AgentDefinition = {
  id: 'seo-optimizer',
  name: 'Search Sage',
  category: 'Marketing',
  description: 'Optimizes website and content for search engines, focusing on local Nigerian search intent and mobile performance.',
  whatItDoes: 'Optimizes website and content for search engines, focusing on local Nigerian search intent and mobile performance.',
  icon: '🔍',
  systemPrompt: SYSTEM_PROMPT,
  configSchema: configSchema,
  defaultConfig,
  tools: tools,
  composioTools: tools,
};
