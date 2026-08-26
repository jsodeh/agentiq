import { z } from 'zod';

export const configSchema = z.object({
  platforms: z.array(z.enum(['Instagram', 'Facebook', 'Twitter', 'LinkedIn'])).default(['Instagram', 'Twitter']),
  postFrequency: z.enum(['Daily', 'ThriceWeekly', 'Weekly']).default('Daily'),
  targetAudience: z.string().default('Young Nigerian Entrepreneurs'),
  brandKeywords: z.array(z.string()).default(['Innovative', 'Reliable', 'Naija-focused']),
});


export const defaultConfig = {
  "platforms": [
    "Instagram",
    "Twitter"
  ],
  "postFrequency": "Daily",
  "targetAudience": "Young Nigerian Entrepreneurs",
  "brandKeywords": [
    "Innovative",
    "Reliable",
    "Naija-focused"
  ]
};
