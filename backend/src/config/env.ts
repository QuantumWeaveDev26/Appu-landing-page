import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z
    .coerce
    .number()
    .int()
    .min(1, 'PORT must be at least 1')
    .max(65535, 'PORT must be at most 65535')
    .default(3000),
  HOST: z
    .string()
    .min(1, 'HOST cannot be empty')
    .default('0.0.0.0'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info')
});

export type AppConfig = z.infer<typeof envSchema>;
