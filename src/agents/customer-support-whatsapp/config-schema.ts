import { z } from 'zod';

export const configSchema = z.object({
  supportTone: z.enum(['Professional', 'Friendly', 'Pidgin-Mix']).default('Friendly'),
  autoEscalateAfter: z.number().describe("Minutes before escalating unresolved issues").default(30),
  knowledgeBaseId: z.string().optional(),
  operatingHours: z.string().default("8am - 6pm WAT"),
});


export const defaultConfig = {
  "supportTone": "Friendly",
  "autoEscalateAfter": 30,
  "knowledgeBaseId": "Sample Value",
  "operatingHours": "8am - 6pm WAT"
};
