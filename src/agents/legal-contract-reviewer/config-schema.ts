import { z } from 'zod';

export const configSchema = z.object({
  jurisdiction: z.string().default('Nigeria'),
  focusClauses: z.array(z.string()).default(['Termination', 'Liability', 'Payment Terms', 'Intellectual Property']),
  riskTolerance: z.enum(['Low', 'Medium', 'High']).default('Low'),
});


export const defaultConfig = {
  "jurisdiction": "Nigeria",
  "focusClauses": [
    "Termination",
    "Liability",
    "Payment Terms",
    "Intellectual Property"
  ],
  "riskTolerance": "Low"
};
