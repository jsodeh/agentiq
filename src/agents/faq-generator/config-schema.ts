import { z } from 'zod';

export const configSchema = z.object({
  faqPageUrl: z.string().url().optional(),
  updateFrequency: z.enum(['daily', 'weekly', 'monthly']).default('weekly'),
});


export const defaultConfig = {
  "faqPageUrl": "https://example.com",
  "updateFrequency": "weekly"
};
