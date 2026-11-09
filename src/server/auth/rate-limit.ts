/**
 * In-memory per-IP limiter for setup-token and pairing-code attempts (FR-008).
 * 5 failures → blocked 15 minutes. Single-instance deployment, so memory is enough.
 */
import { now } from '../clock';
import { ApiError } from '../http/errors';

const MAX_FAILURES = 5;
const BLOCK_MS = 15 * 60 * 1000;

const state = new Map<string, { failures: number; blockedUntil: number }>();

export function checkRateLimit(scope: string, ip: string): void {
  const s = state.get(`${scope}:${ip}`);
  if (!s) return;
  const remaining = s.blockedUntil - now().getTime();
  if (remaining > 0) throw new ApiError('RATE_LIMITED', undefined, { retryAfterSec: Math.ceil(remaining / 1000) });
}

export function registerRateFailure(scope: string, ip: string): void {
  const key = `${scope}:${ip}`;
  const s = state.get(key) ?? { failures: 0, blockedUntil: 0 };
  if (s.blockedUntil && s.blockedUntil <= now().getTime()) {
    s.failures = 0;
    s.blockedUntil = 0;
  }
  s.failures += 1;
  if (s.failures >= MAX_FAILURES) s.blockedUntil = now().getTime() + BLOCK_MS;
  state.set(key, s);
}

export function clearRateLimit(scope: string, ip: string): void {
  state.delete(`${scope}:${ip}`);
}

/** Test helper. */
export function resetRateLimits(): void {
  state.clear();
}
