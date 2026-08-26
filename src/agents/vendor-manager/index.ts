import { AgentDefinition } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { configSchema, defaultConfig } from './config-schema';
import { tools } from './composio-tools';

export const vendorManagerAgent: AgentDefinition = {
  id: 'vendor-manager',
  name: 'Vendor Ally',
  category: 'Operations',
  description: 'Manages relationships with Nigerian vendors, ensuring compliance, timely payments, and performance.',
  whatItDoes: 'Manages relationships with Nigerian vendors, ensuring compliance, timely payments, and performance.',
  icon: '🏭',
  systemPrompt: SYSTEM_PROMPT,
  configSchema: configSchema,
  defaultConfig,
  tools: tools,
  composioTools: tools,
};
