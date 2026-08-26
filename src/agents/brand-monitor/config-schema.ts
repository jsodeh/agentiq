import { z } from 'zod';

export const configSchema = z.object({
  trackedKeywords: z.array(z.string()).default(['{business_name}', 'Nigeria service', 'Customer support']),
  monitorNairaland: z.boolean().default(true),
  sentimentThreshold: z.number().default(0.4),
  alertOnNegativeMentions: z.boolean().default(true),
});


export const defaultConfig = {
  "trackedKeywords": [
    "{business_name}",
    "Nigeria service",
    "Customer support"
  ],
  "monitorNairaland": true,
  "sentimentThreshold": 0.4,
  "alertOnNegativeMentions": true
};
