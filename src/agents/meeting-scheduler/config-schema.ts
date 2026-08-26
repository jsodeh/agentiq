import { z } from 'zod';

export const configSchema = z.object({
  preferredMeetingDuration: z.number().default(30),
  workingHoursStart: z.string().default('09:00'),
  workingHoursEnd: z.string().default('17:00'),
  timezone: z.string().default('Africa/Lagos'),
});


export const defaultConfig = {
  "preferredMeetingDuration": 30,
  "workingHoursStart": "09:00",
  "workingHoursEnd": "17:00",
  "timezone": "Africa/Lagos"
};
