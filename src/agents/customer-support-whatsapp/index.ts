import { AgentDefinition } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { configSchema, defaultConfig } from './config-schema';
import { tools } from './composio-tools';

export const customerSupportWhatsappAgent: AgentDefinition = {
  id: 'customer-support-whatsapp',
  name: 'WhatsApp Support Hero',
  category: 'Support',
  description: 'Provides instant customer support over WhatsApp with local language support.',
  whatItDoes: 'Provides instant customer support over WhatsApp with local language support.',
  icon: '💬',
  systemPrompt: SYSTEM_PROMPT,
  configSchema: configSchema,
  defaultConfig,
  tools: tools,
  composioTools: tools,
};
