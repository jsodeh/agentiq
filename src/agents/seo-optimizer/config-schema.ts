import { z } from 'zod';

export const configSchema = z.object({
  targetKeywords: z.array(z.string()).default(['Best prices in Lagos', 'Buy online Nigeria', 'Services in Abuja']),
  focusOnLocalSEO: z.boolean().default(true),
  mobileOptimizedOnly: z.boolean().default(true),
  checkBacklinksMonthly: z.boolean().default(true),
});


export const defaultConfig = {
  "targetKeywords": [
    "Best prices in Lagos",
    "Buy online Nigeria",
    "Services in Abuja"
  ],
  "focusOnLocalSEO": true,
  "mobileOptimizedOnly": true,
  "checkBacklinksMonthly": true
};
