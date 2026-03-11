import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  SMSC_LOGIN: z.string().default(''),
  SMSC_PASSWORD: z.string().default(''),
  SMSC_SENDER: z.string().default('ReviewHub'),
  ANTHROPIC_API_KEY: z.string().default(''),
  ENCRYPTION_KEY: z.string().min(32).default('dev-key-must-be-at-least-32-chars!!'),
  APP_URL: z.string().default('http://localhost:5173'),
  PWA_URL: z.string().default('http://localhost:5174'),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment variables:', result.error.flatten().fieldErrors);
    process.exit(1);
  }
  return result.data;
}
