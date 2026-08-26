import { z } from 'zod';

export const configSchema = z.object({
  monitoredPlatforms: z.array(z.string()).default(['Slack', 'Discord', 'WhatsApp']),
  autoBanKeywords: z.array(z.string()).default(['spam', 'scam', 'crypto-scam']),
  responseTone: z.string().default('Firm but Polite'),
});


export const defaultConfig = {
  "monitoredPlatforms": [
    "Slack",
    "Discord",
    "WhatsApp"
  ],
  "autoBanKeywords": [
    "spam",
    "scam",
    "crypto-scam"
  ],
  "responseTone": "Firm but Polite"
};
