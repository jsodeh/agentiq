import { z } from 'zod';

export const configSchema = z.object({
  preferredLogisticsPartners: z.array(z.string()).default(['GIG Logistics', 'KOS Software', 'Jumia Logistics']),
  defaultWarehouseLocation: z.string().default('Lagos'),
  currency: z.string().default('NGN'),
  lowStockThreshold: z.number().default(10),
  fuelPriceAwareness: z.boolean().default(true),
});


export const defaultConfig = {
  "preferredLogisticsPartners": [
    "GIG Logistics",
    "KOS Software",
    "Jumia Logistics"
  ],
  "defaultWarehouseLocation": "Lagos",
  "currency": "NGN",
  "lowStockThreshold": 10,
  "fuelPriceAwareness": true
};
