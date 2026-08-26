import { AgentDefinition } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { configSchema, defaultConfig } from './config-schema';
import { tools } from './composio-tools';

export const legalContractReviewerAgent: AgentDefinition = {
  id: 'legal-contract-reviewer',
  name: 'Legal Eye',
  category: 'Legal',
  description: 'Reviews business contracts for risk, compliance, and fairness under Nigerian law.',
  whatItDoes: 'Reviews business contracts for risk, compliance, and fairness under Nigerian law.',
  icon: '📜',
  systemPrompt: SYSTEM_PROMPT,
  configSchema: configSchema,
  defaultConfig,
  tools: tools,
  composioTools: tools,
};
