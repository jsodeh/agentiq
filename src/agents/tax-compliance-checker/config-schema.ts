import { z } from 'zod';

export const configSchema = z.object({
  firsTin: z.string().optional(),
  lirsId: z.string().optional(),
  vatRate: z.number().default(0.075),
  whtRate: z.number().default(0.05),
});


export const defaultConfig = {
  "firsTin": "Sample Value",
  "lirsId": "Sample Value",
  "vatRate": 0.075,
  "whtRate": 0.05
};
