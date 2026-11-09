import { eq } from 'drizzle-orm';
import './cookies';
import { db } from '../db/client';
import { session } from '../db/schema';
import { now } from '../clock';
import { setSessionChecker, type Ctx } from '../http/handler';
import { hashToken, randomToken } from './tokens';

export const SESSION_COOKIE = 'np_session';
export const SESSION_IDLE_MS = 15 * 60 * 1000;

export function createSession(ctx: Ctx, profileId: string): void {
  const token = randomToken();
  const ts = now().toISOString();
  db().insert(session).values({ tokenHash: hashToken(token), profileId, lastSeenAt: ts, createdAt: ts }).run();
  ctx.setCookie(SESSION_COOKIE, token);
}

/** Resolve a session token to its profile, enforcing the inactivity timeout and refreshing it. */
export function profileIdForSessionToken(token: string | undefined): string | null {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const row = db().select().from(session).where(eq(session.tokenHash, tokenHash)).get();
  if (!row) return null;
  const current = now();
  if (current.getTime() - Date.parse(row.lastSeenAt) > SESSION_IDLE_MS) {
    db().delete(session).where(eq(session.tokenHash, tokenHash)).run();
    return null;
  }
  db().update(session).set({ lastSeenAt: current.toISOString() }).where(eq(session.tokenHash, tokenHash)).run();
  return row.profileId;
}

export function readSession(ctx: Ctx): string | null {
  return profileIdForSessionToken(ctx.getCookie(SESSION_COOKIE));
}

setSessionChecker((ctx) => readSession(ctx) !== null);

export function destroySession(ctx: Ctx): void {
  const token = ctx.getCookie(SESSION_COOKIE);
  if (token) db().delete(session).where(eq(session.tokenHash, hashToken(token))).run();
  ctx.clearCookie(SESSION_COOKIE);
}

export function destroyAllSessions(profileId: string): void {
  db().delete(session).where(eq(session.profileId, profileId)).run();
}
