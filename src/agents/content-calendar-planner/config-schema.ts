import { z } from 'zod';

export const configSchema = z.object({
  targetPlatforms: z.array(z.string()).default(['Instagram', 'Twitter', 'TikTok', 'LinkedIn']),
  postingFrequencyPerWeek: z.number().default(5),
  includePidginContent: z.boolean().default(true),
  timezone: z.string().default('Africa/Lagos'),
});


export const defaultConfig = {
  "targetPlatforms": [
    "Instagram",
    "Twitter",
    "TikTok",
    "LinkedIn"
  ],
  "postingFrequencyPerWeek": 5,
  "includePidginContent": true,
  "timezone": "Africa/Lagos"
};
