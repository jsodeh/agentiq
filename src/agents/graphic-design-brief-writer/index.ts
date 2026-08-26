import { AgentDefinition } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { configSchema, defaultConfig } from './config-schema';
import { tools } from './composio-tools';

export const graphicDesignBriefWriterAgent: AgentDefinition = {
  id: 'graphic-design-brief-writer',
  name: 'Creative Scribe',
  category: 'Marketing',
  description: 'Converts marketing concepts into professional, localized design briefs.',
  whatItDoes: 'Converts marketing concepts into professional, localized design briefs.',
  icon: '🎨',
  systemPrompt: SYSTEM_PROMPT,
  configSchema: configSchema,
  defaultConfig,
  tools: tools,
  composioTools: tools,
};
