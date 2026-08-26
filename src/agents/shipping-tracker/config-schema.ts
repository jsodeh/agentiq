import { z } from 'zod';

export const configSchema = z.object({
  trackingUpdateInterval: z.number().default(6), // hours
  delayThreshold: z.number().default(24), // hours before notifying customer of delay
  logisticsPartners: z.array(z.string()).default(['GIGL', 'DHL', 'FedEx', 'Kwik', 'Gokada']),
  supportContact: z.string().email(),
});


export const defaultConfig = {
  "trackingUpdateInterval": 6,
  "delayThreshold": 24,
  "logisticsPartners": [
    "GIGL",
    "DHL",
    "FedEx",
    "Kwik",
    "Gokada"
  ],
  "supportContact": "admin@example.com"
};
