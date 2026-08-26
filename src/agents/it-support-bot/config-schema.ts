import { z } from 'zod';

export const configSchema = z.object({
  supportEmail: z.string().default('support@company.com'),
  priorityKeywords: z.array(z.string()).default(['urgent', 'broken', 'down', 'cannot login']),
  knowledgeBaseUrl: z.string().optional(),
});


export const defaultConfig = {
  "supportEmail": "support@company.com",
  "priorityKeywords": [
    "urgent",
    "broken",
    "down",
    "cannot login"
  ],
  "knowledgeBaseUrl": "https://example.com"
};
