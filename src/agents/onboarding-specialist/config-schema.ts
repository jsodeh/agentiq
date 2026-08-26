import { z } from 'zod';

export const configSchema = z.object({
  welcomeMessage: z.string().default('Welcome to {business_name}! Let’s get you started.'),
  kycRequiredDocs: z.array(z.string()).default(['NIN', 'Utility Bill', 'Passport Photograph']),
  followUpDays: z.number().default(2),
  onboardingManager: z.string().email(),
});


export const defaultConfig = {
  "welcomeMessage": "Welcome to {business_name}! Let\u2019s get you started.",
  "kycRequiredDocs": [
    "NIN",
    "Utility Bill",
    "Passport Photograph"
  ],
  "followUpDays": 2,
  "onboardingManager": "admin@example.com"
};
