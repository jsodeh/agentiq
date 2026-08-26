import { z } from 'zod';

export const configSchema = z.object({
  lowStockThreshold: z.number().default(20),
  warehouseLocations: z.array(z.string()).default(['Lagos-Ikeja', 'Lagos-Lekki', 'Abuja-Garki', 'PH-TransAmadi']),
  inventoryUpdateFrequencyHours: z.number().default(4),
  procurementManagerEmail: z.string().email(),
});


export const defaultConfig = {
  "lowStockThreshold": 20,
  "warehouseLocations": [
    "Lagos-Ikeja",
    "Lagos-Lekki",
    "Abuja-Garki",
    "PH-TransAmadi"
  ],
  "inventoryUpdateFrequencyHours": 4,
  "procurementManagerEmail": "admin@example.com"
};
