import { z } from 'zod';

export const configSchema = z.object({
  preferredManagementTool: z.enum(['Asana', 'Trello', 'Notion', 'Monday.com']).default('Trello'),
  updateFrequency: z.enum(['Daily', 'Weekly']).default('Daily'),
  slackChannel: z.string().default('#project-updates'),
});


export const defaultConfig = {
  "preferredManagementTool": "Trello",
  "updateFrequency": "Daily",
  "slackChannel": "#project-updates"
};
