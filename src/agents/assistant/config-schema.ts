import { z } from 'zod';

export const configSchema = z.object({
  operatingHours: z.string().default('08:00-17:00'),
  timezone: z.string().default('Africa/Lagos'),
  preferredCommunication: z.enum(['email', 'slack', 'whatsapp']).default('email'),
  notificationThreshold: z.number().describe('Urgency level (1-5) for immediate notification').default(3),
});


export const defaultConfig = {
  "operatingHours": "08:00-17:00",
  "timezone": "Africa/Lagos",
  "preferredCommunication": "email",
  "notificationThreshold": 3
};
