import { AgentDefinition } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { configSchema, defaultConfig } from './config-schema';
import { tools } from './composio-tools';

export const faqGeneratorAgent: AgentDefinition = {
  id: 'faq-generator',
  name: 'Knowledge Hub',
  category: 'Support',
  description: 'Dynamically updates FAQs based on common customer questions and product changes.',
  whatItDoes: 'Dynamically updates FAQs based on common customer questions and product changes.',
  icon: '📚',
  systemPrompt: SYSTEM_PROMPT,
  configSchema: configSchema,
  defaultConfig,
  tools: tools,
  composioTools: tools,
};
