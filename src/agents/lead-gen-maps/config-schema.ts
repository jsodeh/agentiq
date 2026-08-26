import { z } from 'zod';

export const configSchema = z.object({
  targetCategory: z.string().min(1, "Category is required"),
  locations: z.array(z.string()).min(1, "At least one location is required"),
  maxLeads: z.number().min(1).max(500).default(50),
  enrichEmails: z.boolean().default(true),
});


export const defaultConfig = {
  "targetCategory": "Sample Value",
  "locations": [
    "Sample"
  ],
  "maxLeads": 50,
  "enrichEmails": true
};
