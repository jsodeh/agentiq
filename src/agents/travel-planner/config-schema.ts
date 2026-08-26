import { z } from 'zod';

export const configSchema = z.object({
  preferredAirlines: z.array(z.string()).default(['Air Peace', 'Ibom Air', 'United Nigeria']),
  bookingPlatform: z.string().default('Wakanow'),
  travelBudgetNaira: z.number().default(200000),
});


export const defaultConfig = {
  "preferredAirlines": [
    "Air Peace",
    "Ibom Air",
    "United Nigeria"
  ],
  "bookingPlatform": "Wakanow",
  "travelBudgetNaira": 200000
};
