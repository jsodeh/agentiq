import { z } from 'zod';

export const configSchema = z.object({
  brandVoice: z.string().default('Modern and Vibrant'),
  preferredTools: z.array(z.string()).default(['Canva', 'Figma', 'Adobe Illustrator']),
  outputFormat: z.enum(['PDF', 'Google Doc', 'Slack Message']).default('Google Doc'),
});


export const defaultConfig = {
  "brandVoice": "Modern and Vibrant",
  "preferredTools": [
    "Canva",
    "Figma",
    "Adobe Illustrator"
  ],
  "outputFormat": "Google Doc"
};
