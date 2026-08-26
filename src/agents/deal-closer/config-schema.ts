import { z } from 'zod';

export const configSchema = z.object({
  maxDiscountPercentage: z.number().max(30).default(10),
  preferredPaymentMethod: z.enum(['BankTransfer', 'OnlinePayment', 'Installments']).default('OnlinePayment'),
  contractTemplateId: z.string().optional(),
  urgentFollowUpHours: z.number().default(24),
});


export const defaultConfig = {
  "maxDiscountPercentage": 10,
  "preferredPaymentMethod": "OnlinePayment",
  "contractTemplateId": "Sample Value",
  "urgentFollowUpHours": 24
};
