import { z } from 'zod';

export const configSchema = z.object({
  preferredMeetingDuration: z.number().default(30),
  timezone: z.string().default('Africa/Lagos'),
  bufferMinutes: z.number().default(15),
  workingHoursStart: z.string().default('09:00'),
  workingHoursEnd: z.string().default('17:00'),
});


export const defaultConfig = {
  "preferredMeetingDuration": 30,
  "timezone": "Africa/Lagos",
  "bufferMinutes": 15,
  "workingHoursStart": "09:00",
  "workingHoursEnd": "17:00"
};
