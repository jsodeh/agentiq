import { AgentDefinition } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { configSchema, defaultConfig } from './config-schema';
import { tools } from './composio-tools';

export const pricingOptimizerAgent: AgentDefinition = {
  id: 'pricing-optimizer',
  name: 'Profit Maximizer',
  category: 'Operations',
  description: 'Adjusts pricing based on demand, competition (Jumia/Konga), and inflation trends in Nigeria.',
  whatItDoes: 'Adjusts pricing based on demand, competition (Jumia/Konga), and inflation trends in Nigeria.',
  icon: '📈',
  systemPrompt: SYSTEM_PROMPT,
  configSchema: configSchema,
  defaultConfig,
  tools: tools,
  composioTools: tools,
};
