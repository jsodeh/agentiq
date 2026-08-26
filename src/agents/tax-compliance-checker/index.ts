import { AgentDefinition } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { configSchema, defaultConfig } from './config-schema';
import { tools } from './composio-tools';

export const taxComplianceCheckerAgent: AgentDefinition = {
  id: 'tax-compliance-checker',
  name: 'Tax Sentry',
  category: 'Finance',
  description: 'Ensures compliance with FIRS, LIRS, VAT, and WHT regulations in Nigeria.',
  whatItDoes: 'Ensures compliance with FIRS, LIRS, VAT, and WHT regulations in Nigeria.',
  icon: '⚖️',
  systemPrompt: SYSTEM_PROMPT,
  configSchema: configSchema,
  defaultConfig,
  tools: tools,
  composioTools: tools,
};
