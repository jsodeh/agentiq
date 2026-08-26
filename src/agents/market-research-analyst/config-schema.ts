import { z } from 'zod';

export const configSchema = z.object({
  targetIndustries: z.array(z.string()).default(['Fintech', 'E-commerce', 'Agriculture']),
  competitors: z.array(z.string()).default([]),
  reportFormat: z.enum(['PDF', 'Google Slide', 'Notion']).default('Notion'),
});


export const defaultConfig = {
  "targetIndustries": [
    "Fintech",
    "E-commerce",
    "Agriculture"
  ],
  "competitors": [],
  "reportFormat": "Notion"
};
