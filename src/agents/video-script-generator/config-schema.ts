import { z } from 'zod';

export const configSchema = z.object({
  preferredPlatform: z.enum(['TikTok', 'Reels', 'YouTube', 'YouTube Shorts']).default('TikTok'),
  scriptLengthSeconds: z.number().default(60),
  includeLocalSlang: z.boolean().default(true),
  callToActionType: z.string().default('Link in Bio'),
});


export const defaultConfig = {
  "preferredPlatform": "TikTok",
  "scriptLengthSeconds": 60,
  "includeLocalSlang": true,
  "callToActionType": "Link in Bio"
};
