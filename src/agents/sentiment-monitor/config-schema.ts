import { z } from 'zod';

export const configSchema = z.object({
  brandKeywords: z.array(z.string()).default([]),
  negativeSentimentThreshold: z.number().default(0.3),
  alertChannels: z.array(z.string()).default(['whatsapp', 'slack']),
});


export const defaultConfig = {
  "brandKeywords": [],
  "negativeSentimentThreshold": 0.3,
  "alertChannels": [
    "whatsapp",
    "slack"
  ]
};
