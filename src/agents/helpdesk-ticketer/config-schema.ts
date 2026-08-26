import { z } from 'zod';

export const configSchema = z.object({
  supportEmail: z.string().email().default('support@example.com'),
  slaHours: z.number().default(24),
  priorityKeywords: z.array(z.string()).default(['urgent', 'payment', 'broken', 'failed']),
});


export const defaultConfig = {
  "supportEmail": "support@example.com",
  "slaHours": 24,
  "priorityKeywords": [
    "urgent",
    "payment",
    "broken",
    "failed"
  ]
};
