import { z } from 'zod';

export const configSchema = z.object({
  competitorUrls: z.array(z.string()).default([]),
  trackingFrequency: z.enum(['daily', 'weekly', 'real-time']).default('daily'),
  keywords: z.array(z.string()).default(['price', 'promo', 'new launch']),
});


export const defaultConfig = {
  "competitorUrls": [],
  "trackingFrequency": "daily",
  "keywords": [
    "price",
    "promo",
    "new launch"
  ]
};
