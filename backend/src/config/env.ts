import { z } from 'zod';

export const envSchema = z
  .object({
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
      .default('info'),
    CORS_ALLOWED_ORIGINS: z
      .string()
      .optional(),
    DATABASE_URL: z
      .string()
      .optional(),
    SUPABASE_URL: z
      .string()
      .url('SUPABASE_URL must be a valid URL')
      .optional(),
    SUPABASE_PUBLISHABLE_KEY: z
      .string()
      .min(1, 'SUPABASE_PUBLISHABLE_KEY cannot be empty')
      .optional(),
    SUPABASE_ANON_KEY: z
      .string()
      .min(1, 'SUPABASE_ANON_KEY cannot be empty')
      .optional(),
    RAZORPAY_KEY_ID: z
      .string()
      .min(1, 'RAZORPAY_KEY_ID cannot be empty')
      .optional(),
    RAZORPAY_KEY_SECRET: z
      .string()
      .min(1, 'RAZORPAY_KEY_SECRET cannot be empty')
      .optional(),
    RAZORPAY_WEBHOOK_SECRET: z
      .string()
      .min(1, 'RAZORPAY_WEBHOOK_SECRET cannot be empty')
      .optional(),
    RAZORPAY_PLAN_MAPPINGS: z
      .string()
      .optional(),
    RAZORPAY_PLAN_STARTER_ID: z
      .string()
      .min(1, 'RAZORPAY_PLAN_STARTER_ID cannot be empty')
      .optional(),
    RAZORPAY_PLAN_GROWTH_ID: z
      .string()
      .min(1, 'RAZORPAY_PLAN_GROWTH_ID cannot be empty')
      .optional(),
    RAZORPAY_PLAN_FAMILY_ID: z
      .string()
      .min(1, 'RAZORPAY_PLAN_FAMILY_ID cannot be empty')
      .optional(),
    N8N_APPU_WEBHOOK_URL: z
      .string()
      .url('N8N_APPU_WEBHOOK_URL must be a valid URL')
      .optional(),
    N8N_APPU_REQUEST_HMAC_SECRET: z
      .string()
      .min(32, 'N8N_APPU_REQUEST_HMAC_SECRET must be at least 32 characters')
      .optional(),
    N8N_APPU_CALLBACK_HMAC_SECRET: z
      .string()
      .min(32, 'N8N_APPU_CALLBACK_HMAC_SECRET must be at least 32 characters')
      .optional(),
    N8N_APPU_HMAC_MAX_AGE_SECONDS: z
      .coerce.number().int().min(30).max(900).default(300),
    N8N_APPU_TIMEOUT_MS: z
      .coerce.number().int().min(1000).max(120000).default(20000),
    GUEST_SESSION_SECRET: z
      .string()
      .min(16, 'GUEST_SESSION_SECRET must be at least 16 characters')
      .optional()
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production') {
      if (!data.GUEST_SESSION_SECRET || !data.GUEST_SESSION_SECRET.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['GUEST_SESSION_SECRET'],
          message: 'GUEST_SESSION_SECRET is required in production and must not be empty'
        });
      }

      if (data.N8N_APPU_WEBHOOK_URL) {
        if (!data.N8N_APPU_REQUEST_HMAC_SECRET) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['N8N_APPU_REQUEST_HMAC_SECRET'],
            message: 'N8N_APPU_REQUEST_HMAC_SECRET is required when the production APPU webhook is configured'
          });
        }
        if (!data.N8N_APPU_CALLBACK_HMAC_SECRET) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['N8N_APPU_CALLBACK_HMAC_SECRET'],
            message: 'N8N_APPU_CALLBACK_HMAC_SECRET is required when the production APPU webhook is configured'
          });
        }
      }
    }
  });

export type AppConfig = z.infer<typeof envSchema>;
