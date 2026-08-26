import { z } from 'zod';

export const configSchema = z.object({
  summaryLength: z.enum(['Short', 'Medium', 'Detailed']).default('Medium'),
  focusAreas: z.array(z.string()).default(['Action Items', 'Key Decisions', 'Financials']),
  outputChannel: z.enum(['Slack', 'Email', 'Notion']).default('Slack'),
});


export const defaultConfig = {
  "summaryLength": "Medium",
  "focusAreas": [
    "Action Items",
    "Key Decisions",
    "Financials"
  ],
  "outputChannel": "Slack"
};
