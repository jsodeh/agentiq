import { z } from 'zod';

export const configSchema = z.object({
  payDay: z.number().min(1).max(31).default(25),
  pensionProvider: z.string().default('Stanbic IBTC Pension'),
  taxState: z.string().default('Lagos'),
  includeNHF: z.boolean().default(true),
});


export const defaultConfig = {
  "payDay": 25,
  "pensionProvider": "Stanbic IBTC Pension",
  "taxState": "Lagos",
  "includeNHF": true
};
