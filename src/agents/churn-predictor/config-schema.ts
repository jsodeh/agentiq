import { z } from 'zod';

export const configSchema = z.object({
  churnRiskScoreThreshold: z.number().min(0).max(100).default(70),
  loyaltyOfferPercentage: z.number().default(10),
  checkFrequencyDays: z.number().default(7),
  retentionManagerEmail: z.string().email(),
});


export const defaultConfig = {
  "churnRiskScoreThreshold": 70,
  "loyaltyOfferPercentage": 10,
  "checkFrequencyDays": 7,
  "retentionManagerEmail": "admin@example.com"
};
