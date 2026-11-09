import crypto from 'node:crypto';
import { env } from '../env';

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

/** Keyed hash of a bearer token; only hashes are stored. */
export function hashToken(token: string): string {
  return crypto.createHmac('sha256', env().SESSION_SECRET).update(token).digest('hex');
}

export function constantTimeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb) && a.length === b.length;
}
