import { AgentDefinition } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { configSchema, defaultConfig } from './config-schema';
import { tools } from './composio-tools';

export const payrollAssistantAgent: AgentDefinition = {
  id: 'payroll-assistant',
  name: 'Paymaster',
  category: 'HR',
  description: 'Manages employee salaries, pensions (PENCOM), and statutory deductions in Nigeria.',
  whatItDoes: 'Manages employee salaries, pensions (PENCOM), and statutory deductions in Nigeria.',
  icon: '💰',
  systemPrompt: SYSTEM_PROMPT,
  configSchema: configSchema,
  defaultConfig,
  tools: tools,
  composioTools: tools,
};
