import { z } from 'zod';

export const configSchema = z.object({
  minVendorRating: z.number().min(1).max(5).default(3.5),
  standardPaymentTerms: z.number().default(30), // days
  complianceCheckMonths: z.number().default(6),
  financeEmail: z.string().email(),
});


export const defaultConfig = {
  "minVendorRating": 3.5,
  "standardPaymentTerms": 30,
  "complianceCheckMonths": 6,
  "financeEmail": "admin@example.com"
};
