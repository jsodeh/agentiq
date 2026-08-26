import { z } from 'zod';

export const configSchema = z.object({
  reportingInterval: z.enum(['Daily', 'Weekly', 'Monthly']).default('Weekly'),
  kpisToTrack: z.array(z.string()).default(['Revenue', 'ConversionRate', 'AverageDealValue']),
  slackChannelForReports: z.string().default('#sales-reports'),
  targetRevenueNGN: z.number().optional(),
});


export const defaultConfig = {
  "reportingInterval": "Weekly",
  "kpisToTrack": [
    "Revenue",
    "ConversionRate",
    "AverageDealValue"
  ],
  "slackChannelForReports": "#sales-reports",
  "targetRevenueNGN": 10
};
