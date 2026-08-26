import { AgentDefinition } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { configSchema, defaultConfig } from './config-schema';
import { tools } from './composio-tools';

export const marketResearchAnalystAgent: AgentDefinition = {
  id: 'market-research-analyst',
  name: 'Insight Hub',
  category: 'Marketing',
  description: 'Conducts market research, analyzes competitors, and identifies trends in Nigeria.',
  whatItDoes: 'Conducts market research, analyzes competitors, and identifies trends in Nigeria.',
  icon: '📊',
  systemPrompt: SYSTEM_PROMPT,
  configSchema: configSchema,
  defaultConfig,
  tools: tools,
  composioTools: tools,
};
