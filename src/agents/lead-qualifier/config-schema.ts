import { z } from 'zod';

export const configSchema = z.object({
  minBudget: z.number().default(100000),
  targetIndustries: z.array(z.string()).default(['Retail', 'Tech', 'Fintech']),
  qualificationQuestions: z.array(z.string()).default([
    'What is your estimated monthly volume?',
    'What is your current solution?',
    'When are you looking to start?'
  ]),
});


export const defaultConfig = {
  "minBudget": 100000,
  "targetIndustries": [
    "Retail",
    "Tech",
    "Fintech"
  ],
  "qualificationQuestions": [
    "Sample"
  ]
};
