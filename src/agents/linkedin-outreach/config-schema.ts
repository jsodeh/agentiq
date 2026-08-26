import { z } from 'zod';

export const configSchema = z.object({
  targetIndustries: z.array(z.string()).default(['Fintech', 'Real Estate', 'Tech']),
  targetJobTitles: z.array(z.string()).default(['CEO', 'Founder', 'Operations Manager']),
  maxConnectionsPerDay: z.number().max(50).default(20),
  connectionNoteTemplate: z.string().min(10, "Template is too short"),
});


export const defaultConfig = {
  "targetIndustries": [
    "Fintech",
    "Real Estate",
    "Tech"
  ],
  "targetJobTitles": [
    "CEO",
    "Founder",
    "Operations Manager"
  ],
  "maxConnectionsPerDay": 20,
  "connectionNoteTemplate": "Sample Value"
};
