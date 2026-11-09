/** SETUP_TOKEN checks (FR-008). The token lives only in server env and is never sent to clients. */
import { count } from 'drizzle-orm';
import { db } from '../db/client';
import { profile } from '../db/schema';
import { env } from '../env';
import type { Ctx } from '../http/handler';
import { constantTimeEqual } from './tokens';
import { checkRateLimit, clearRateLimit, registerRateFailure } from './rate-limit';

/** Constant-time comparison, rate limited per IP. False when SETUP_TOKEN is not configured. */
export function verifySetupToken(ctx: Ctx, input: string | undefined): boolean {
  if (!input) return false;
  checkRateLimit('setup_token', ctx.ip);
  const expected = env().SETUP_TOKEN;
  const ok = Boolean(expected) && constantTimeEqual(input, expected!);
  if (ok) clearRateLimit('setup_token', ctx.ip);
  else registerRateFailure('setup_token', ctx.ip);
  return ok;
}

export function profileCount(): number {
  return db().select({ n: count() }).from(profile).get()?.n ?? 0;
}

export type CreationAuthority = 'initial_setup' | 'session' | 'setup_token';

/** Who may create a profile: anyone while none exist; afterwards a session or a valid setup token. */
export function creationAuthority(
  ctx: Ctx,
  sessionProfileId: string | null,
  setupToken: string | undefined,
): CreationAuthority | null {
  if (profileCount() === 0) return 'initial_setup';
  if (sessionProfileId) return 'session';
  if (verifySetupToken(ctx, setupToken)) return 'setup_token';
  return null;
}
