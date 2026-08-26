import { z } from 'zod';

export const configSchema = z.object({
  maxDailyDeliveriesPerRider: z.number().default(15),
  fuelRatePerKm: z.number().default(50), // Naira
  fleetMaintenanceIntervalKm: z.number().default(1000),
  fleetManagerEmail: z.string().email(),
});


export const defaultConfig = {
  "maxDailyDeliveriesPerRider": 15,
  "fuelRatePerKm": 50,
  "fleetMaintenanceIntervalKm": 1000,
  "fleetManagerEmail": "admin@example.com"
};
