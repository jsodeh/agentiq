import { AgentDefinition } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { configSchema, defaultConfig } from './config-schema';
import { tools } from './composio-tools';

export const invoiceGeneratorAgent: AgentDefinition = {
  id: 'invoice-generator',
  name: 'Smart Invoice Generator',
  category: 'Operations',
  description: 'Creates professional, VAT-compliant invoices and sends them to customers.',
  whatItDoes: 'Creates professional, VAT-compliant invoices and sends them to customers.',
  icon: '🧾',
  systemPrompt: SYSTEM_PROMPT,
  configSchema: configSchema,
  defaultConfig,
  tools: tools,
  composioTools: tools,
};
