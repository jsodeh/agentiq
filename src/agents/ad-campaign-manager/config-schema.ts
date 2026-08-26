import { z } from 'zod';

export const configSchema = z.object({
  monthlyAdBudgetNaira: z.number().default(500000),
  preferredPlatforms: z.array(z.string()).default(['Facebook', 'Instagram']),
  targetStates: z.array(z.string()).default(['Lagos', 'Abuja', 'Port Harcourt', 'Kano']),
  useNairaForBilling: z.boolean().default(true),
});


export const defaultConfig = {
  "monthlyAdBudgetNaira": 500000,
  "preferredPlatforms": [
    "Facebook",
    "Instagram"
  ],
  "targetStates": [
    "Lagos",
    "Abuja",
    "Port Harcourt",
    "Kano"
  ],
  "useNairaForBilling": true
};
