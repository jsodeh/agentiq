import { z } from 'zod';

export const configSchema = z.object({
  vatRate: z.number().default(7.5),
  currency: z.string().default('NGN'),
  bankDetails: z.string().min(1, "Bank account details are required"),
  dueDays: z.number().default(7),
  companyTIN: z.string().optional(),
});


export const defaultConfig = {
  "vatRate": 7.5,
  "currency": "NGN",
  "bankDetails": "Sample Value",
  "dueDays": 7,
  "companyTIN": "Sample Value"
};
