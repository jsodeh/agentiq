import { AgentDefinition } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { configSchema, defaultConfig } from './config-schema';
import { tools } from './composio-tools';

export const churnPredictorAgent: AgentDefinition = {
  id: 'churn-predictor',
  name: 'Churn Guard',
  category: 'Marketing',
  description: 'Analyzes customer behavior to predict churn and automates retention campaigns.',
  whatItDoes: 'Analyzes customer behavior to predict churn and automates retention campaigns.',
  icon: '🛡️',
  systemPrompt: SYSTEM_PROMPT,
  configSchema: configSchema,
  defaultConfig,
  tools: tools,
  composioTools: tools,
};
