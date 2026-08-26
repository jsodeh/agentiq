import { z } from 'zod';

export const configSchema = z.object({
  nurtureSequenceLength: z.number().default(5),
  daysBetweenEmails: z.number().default(3),
  focusTopic: z.string().default('Customer Success'),
  targetSegment: z.string().default('Inactive Users'),
});


export const defaultConfig = {
  "nurtureSequenceLength": 5,
  "daysBetweenEmails": 3,
  "focusTopic": "Customer Success",
  "targetSegment": "Inactive Users"
};
