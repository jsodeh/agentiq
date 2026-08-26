import { z } from 'zod';

export const configSchema = z.object({
  safetyStockMultiplier: z.number().default(1.2),
  accuracyThresholdPercentage: z.number().default(98),
  warehouseManagerEmail: z.string().email(),
  location: z.string().default('Lagos'),
});


export const defaultConfig = {
  "safetyStockMultiplier": 1.2,
  "accuracyThresholdPercentage": 98,
  "warehouseManagerEmail": "admin@example.com",
  "location": "Lagos"
};
