import { z } from 'zod';

export const configSchema = z.object({
  targetAudience: z.string().min(1, "Target audience is required"),
  outreachChannel: z.enum(['WhatsApp', 'Email', 'Both']).default('Both'),
  dailyLimit: z.number().min(1).max(100).default(20),
  offerDetails: z.string().min(10, "Provide more details about the offer"),
  followUpDays: z.number().default(3),
});


export const defaultConfig = {
  "targetAudience": "Sample Value",
  "outreachChannel": "Both",
  "dailyLimit": 20,
  "offerDetails": "Sample Value",
  "followUpDays": 3
};
