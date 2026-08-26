import { AgentDefinition } from '../types';
import { SYSTEM_PROMPT } from './system-prompt';
import { configSchema, defaultConfig } from './config-schema';
import { tools } from './composio-tools';

export const onboardingSpecialistAgent: AgentDefinition = {
  id: 'onboarding-specialist',
  name: 'Onboarder Pro',
  category: 'Operations',
  description: 'Streamlines the onboarding process for new clients or vendors, managing KYC and initial setup.',
  whatItDoes: 'Streamlines the onboarding process for new clients or vendors, managing KYC and initial setup.',
  icon: '🤝',
  systemPrompt: SYSTEM_PROMPT,
  configSchema: configSchema,
  defaultConfig,
  tools: tools,
  composioTools: tools,
};
