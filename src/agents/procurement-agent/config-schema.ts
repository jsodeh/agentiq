import { z } from 'zod';

export const configSchema = z.object({
  preferredMarketSources: z.array(z.string()).default(['Alaba International', 'Balogun Market', 'Congo Market']),
  maxPurchaseLimitNaira: z.number().default(1000000),
  fxTrackingEnabled: z.boolean().default(true),
  paymentTerms: z.string().default('Net 30'),
});


export const defaultConfig = {
  "preferredMarketSources": [
    "Alaba International",
    "Balogun Market",
    "Congo Market"
  ],
  "maxPurchaseLimitNaira": 1000000,
  "fxTrackingEnabled": true,
  "paymentTerms": "Net 30"
};
