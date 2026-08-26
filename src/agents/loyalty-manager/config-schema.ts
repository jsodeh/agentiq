import { z } from 'zod';

export const configSchema = z.object({
  pointsPerNaira: z.number().default(0.01),
  tierThresholds: z.object({
    silver: z.number().default(100000),
    gold: z.number().default(500000),
    platinum: z.number().default(1000000),
  }).default({
    silver: 100000,
    gold: 500000,
    platinum: 1000000,
  }),
});


export const defaultConfig = {
  "pointsPerNaira": 0.01,
  "tierThresholds": {
    "bronze": 0,
    "silver": 100,
    "gold": 500
  },
  "silver": 100000,
  "gold": 500000,
  "platinum": 1000000
};
