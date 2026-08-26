import { z } from 'zod';

export const configSchema = z.object({
  preferredStack: z.string().default('TypeScript/React'),
  lintingRules: z.enum(['standard', 'strict']).default('standard'),
  autoCommit: z.boolean().default(false),
  sandboxMode: z.boolean().default(true),
});


export const defaultConfig = {
  "preferredStack": "TypeScript/React",
  "lintingRules": "standard",
  "autoCommit": false,
  "sandboxMode": true
};
