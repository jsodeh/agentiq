import { AgentDefinition } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { configSchema, defaultConfig } from './config-schema';
import { tools } from './composio-tools';

export const documentSummarizerAgent: AgentDefinition = {
  id: 'document-summarizer',
  name: 'Brief Bot',
  category: 'Productivity',
  description: 'Summarizes long documents, extracting key decisions and action items.',
  whatItDoes: 'Summarizes long documents, extracting key decisions and action items.',
  icon: '📄',
  systemPrompt: SYSTEM_PROMPT,
  configSchema: configSchema,
  defaultConfig,
  tools: tools,
  composioTools: tools,
};
