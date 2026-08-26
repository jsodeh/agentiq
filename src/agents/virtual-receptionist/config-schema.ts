import { z } from 'zod';

export const configSchema = z.object({
  greetingMessage: z.string().default('Welcome to {business_name}, how can we help you today?'),
  forwardingEmail: z.string().optional(),
  forwardingSlackChannel: z.string().default('#general'),
});


export const defaultConfig = {
  "greetingMessage": "Welcome to {business_name}, how can we help you today?",
  "forwardingEmail": "admin@example.com",
  "forwardingSlackChannel": "#general"
};
