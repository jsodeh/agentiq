import { z } from 'zod';

export const configSchema = z.object({
  minMargin: z.number().default(10),
  maxMargin: z.number().default(50),
  dynamicPricingEnabled: z.boolean().default(true),
  competitorBenchmark: z.string().default('Jumia'),
});


export const defaultConfig = {
  "minMargin": 10,
  "maxMargin": 50,
  "dynamicPricingEnabled": true,
  "competitorBenchmark": "Jumia"
};
