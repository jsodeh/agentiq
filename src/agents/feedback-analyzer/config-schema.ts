import { z } from 'zod';

export const configSchema = z.object({
  analysisInterval: z.enum(['weekly', 'monthly']).default('weekly'),
  sentimentThreshold: z.number().default(0.4),
});


export const defaultConfig = {
  "analysisInterval": "weekly",
  "sentimentThreshold": 0.4
};
