import { z } from 'zod';

export const configSchema = z.object({
  newsletterFrequency: z.enum(['Weekly', 'Bi-weekly', 'Monthly']).default('Weekly'),
  tone: z.string().default('Professional yet Friendly'),
  includePidginSection: z.boolean().default(true),
  targetAudience: z.string().default('Nigerian Professionals & Business Owners'),
});


export const defaultConfig = {
  "newsletterFrequency": "Weekly",
  "tone": "Professional yet Friendly",
  "includePidginSection": true,
  "targetAudience": "Nigerian Professionals & Business Owners"
};
