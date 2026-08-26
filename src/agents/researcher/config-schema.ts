import { z } from 'zod';

export const configSchema = z.object({
  depth: z.enum(['surface', 'deep']).default('surface'),
  includeCompetitorAnalysis: z.boolean().default(true),
  reportingInterval: z.enum(['daily', 'weekly', 'on-demand']).default('weekly'),
  focusLocales: z.array(z.string()).default(['Lagos', 'Abuja']),
});


export const defaultConfig = {
  "depth": "surface",
  "includeCompetitorAnalysis": true,
  "reportingInterval": "weekly",
  "focusLocales": [
    "Lagos",
    "Abuja"
  ]
};
