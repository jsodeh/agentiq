import { z } from 'zod';

export const configSchema = z.object({
  maxRefundAmount: z.number().default(50000), // In Naira
  autoResolveThreshold: z.number().default(5000),
  escalationEmail: z.string().email(),
  defaultCurrency: z.string().default('NGN'),
});


export const defaultConfig = {
  "maxRefundAmount": 50000,
  "autoResolveThreshold": 5000,
  "escalationEmail": "admin@example.com",
  "defaultCurrency": "NGN"
};
