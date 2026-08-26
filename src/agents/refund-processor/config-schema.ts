import { z } from 'zod';

export const configSchema = z.object({
  maxAutoRefundAmount: z.number().default(5000),
  refundPolicyUrl: z.string().url().optional(),
  approvalRequiredAbove: z.number().default(10000),
});


export const defaultConfig = {
  "maxAutoRefundAmount": 5000,
  "refundPolicyUrl": "https://example.com",
  "approvalRequiredAbove": 10000
};
