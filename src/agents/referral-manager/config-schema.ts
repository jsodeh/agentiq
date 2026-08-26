import { z } from 'zod';

export const configSchema = z.object({
  referralBonus: z.string().default('500 NGN'),
  minPurchaseForReferral: z.number().default(5000),
  maxReferralsPerUser: z.number().default(10),
});


export const defaultConfig = {
  "referralBonus": "500 NGN",
  "minPurchaseForReferral": 5000,
  "maxReferralsPerUser": 10
};
