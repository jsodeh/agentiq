import { z } from 'zod';

export const configSchema = z.object({
  baseCurrency: z.string().default('NGN'),
  trackPettyCash: z.boolean().default(true),
  expenseLimitNaira: z.number().default(50000),
  volatilityBufferPercent: z.number().default(10),
});


export const defaultConfig = {
  "baseCurrency": "NGN",
  "trackPettyCash": true,
  "expenseLimitNaira": 50000,
  "volatilityBufferPercent": 10
};
