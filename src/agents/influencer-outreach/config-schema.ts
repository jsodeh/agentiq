import { z } from 'zod';

export const configSchema = z.object({
  targetNiche: z.string().default('Lifestyle & Tech'),
  minFollowerCount: z.number().default(5000),
  preferredLocation: z.string().default('Lagos'),
  maxBudgetPerPostNaira: z.number().default(200000),
});


export const defaultConfig = {
  "targetNiche": "Lifestyle & Tech",
  "minFollowerCount": 5000,
  "preferredLocation": "Lagos",
  "maxBudgetPerPostNaira": 200000
};
