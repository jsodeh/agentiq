import { AgentDefinition } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { configSchema, defaultConfig } from './config-schema';
import { tools } from './composio-tools';

export const feedbackAnalyzerAgent: AgentDefinition = {
  id: 'feedback-analyzer',
  name: 'Voice of Customer',
  category: 'Marketing',
  description: 'Aggregates and summarizes customer feedback from multiple Nigerian touchpoints.',
  whatItDoes: 'Aggregates and summarizes customer feedback from multiple Nigerian touchpoints.',
  icon: '🗣️',
  systemPrompt: SYSTEM_PROMPT,
  configSchema: configSchema,
  defaultConfig,
  tools: tools,
  composioTools: tools,
};
