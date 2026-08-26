import { z } from 'zod';

export const AgentConfigSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  type: z.enum(['general', 'research', 'coding', 'communication', 'data-analysis', 'custom']),
  systemPrompt: z.string().min(10, 'System prompt must be at least 10 characters'),
  tools: z.array(z.string()),
  autonomyLevel: z.enum(['low', 'medium', 'high']),
  escalationThreshold: z.number().min(0).max(100),
});

export const TaskSchema = z.object({
  agentId: z.number().positive(),
  description: z.string().min(1, 'Description is required'),
});

export const UserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
});

export const MessageSchema = z.object({
  conversationId: z.number().positive(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1, 'Content is required'),
});

export type AgentConfigInput = z.infer<typeof AgentConfigSchema>;
export type TaskInput = z.infer<typeof TaskSchema>;
export type UserInput = z.infer<typeof UserSchema>;
export type MessageInput = z.infer<typeof MessageSchema>;
