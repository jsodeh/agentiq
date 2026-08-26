import { z } from 'zod';

export const configSchema = z.object({
  notifyCustomerOnWhatsApp: z.boolean().default(true),
  paymentProvider: z.enum(['Paystack', 'Flutterwave', 'BankTransfer']).default('Paystack'),
  minimumOrderValue: z.number().default(1000),
  deliveryChecklist: z.array(z.string()).default(['Confirm Address', 'Check Stock', 'Verify Payment']),
});


export const defaultConfig = {
  "notifyCustomerOnWhatsApp": true,
  "paymentProvider": "Paystack",
  "minimumOrderValue": 1000,
  "deliveryChecklist": [
    "Confirm Address",
    "Check Stock",
    "Verify Payment"
  ]
};
