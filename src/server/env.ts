import { z } from 'zod';

const boolFromString = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1')
  .optional();

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET debe tener al menos 32 caracteres'),
  DATABASE_PATH: z.string().min(1).default('./data/nutripet.db'),
  SETUP_TOKEN: z.string().min(32, 'SETUP_TOKEN debe tener al menos 32 caracteres').optional(),
  COOKIE_SECURE: boolFromString,
  TCAC_ENABLED: boolFromString,
  OFF_USER_AGENT: z.string().optional(),
  APP_TIMEZONE_DEFAULT: z.string().default('America/Bogota'),
});

export type Env = z.infer<typeof schema> & { cookieSecure: boolean; tcacEnabled: boolean };

let cached: Env | undefined;

/** Validated server environment. Never import this from client components. */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse({
    ...process.env,
    SETUP_TOKEN: process.env.SETUP_TOKEN || undefined,
    COOKIE_SECURE: process.env.COOKIE_SECURE || undefined,
    TCAC_ENABLED: process.env.TCAC_ENABLED || undefined,
  });
  if (!parsed.success) {
    throw new Error(`Configuración inválida: ${parsed.error.issues.map((i) => `${i.path}: ${i.message}`).join('; ')}`);
  }
  const e = parsed.data;
  cached = {
    ...e,
    cookieSecure: e.COOKIE_SECURE ?? e.NODE_ENV === 'production',
    tcacEnabled: e.TCAC_ENABLED ?? false,
  };
  return cached;
}

/** Test helper: forget the cached environment so tests can change process.env. */
export function resetEnvCache(): void {
  cached = undefined;
}
