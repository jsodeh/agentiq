import { z } from 'zod';

export const configSchema = z.object({
  maxSources: z.number().min(3).max(20),
  citationStyle: z.enum(['APA', 'MLA', 'Chicago', 'Harvard']),
  deepResearch: z.boolean(),
  language: z.string(),
});

export type ConfigType = z.infer<typeof configSchema>;

export const defaultConfig: ConfigType = {
  maxSources: 10,
  citationStyle: 'APA',
  deepResearch: false,
  language: 'English',
};
