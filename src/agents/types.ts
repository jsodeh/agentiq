import { z } from 'zod';
import type { AgentIntegration } from './setup-metadata';

export interface AgentDefinition {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: string;
  whatItDoes?: string;
  systemPrompt: string;
  configSchema: z.ZodObject<any>;
  defaultConfig?: any;
  composioTools?: string[];
  tools?: string[];
  skills?: string[];
  integrations?: AgentIntegration[];
}

export interface AgentConfig {
  name: string;
  type: AgentType;
  systemPrompt: string;
  tools: string[];
  autonomyLevel: 'low' | 'medium' | 'high';
  escalationThreshold: number;
}

export type AgentType = 
  | 'general'
  | 'research'
  | 'coding'
  | 'communication'
  | 'data-analysis'
  | 'custom';

export interface AgentSystemPrompts {
  general: string;
  research: string;
  coding: string;
  communication: string;
  'data-analysis': string;
  custom: string;
}

