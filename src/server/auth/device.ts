/** Device enrollment: only enrolled devices may see the profile selector (FR-008). */
import { and, eq, isNull } from 'drizzle-orm';
import './cookies';
import { db } from '../db/client';
import { device, pairingCode } from '../db/schema';
import { newId } from '../db/ids';
import { now } from '../clock';
import { ApiError } from '../http/errors';
import type { Ctx } from '../http/handler';
import { hashToken, randomToken } from './tokens';
import { generatePairingCode, hashSecret, normalizeCode, verifySecret } from './pin';
import { checkRateLimit, clearRateLimit, registerRateFailure } from './rate-limit';

export const DEVICE_COOKIE = 'np_device';
const DEVICE_TTL_DAYS = 180;
const PAIRING_TTL_MIN = 10;

export type EnrolledVia = 'initial_setup' | 'setup_token' | 'pairing_code';
export type DeviceRow = typeof device.$inferSelect;

export function enrollDevice(ctx: Ctx, via: EnrolledVia, label: string, byProfileId: string | null = null): DeviceRow {
  const token = randomToken();
  const ts = now();
  const expires = new Date(ts.getTime() + DEVICE_TTL_DAYS * 86_400_000);
  const row: DeviceRow = {
    id: newId(),
    tokenHash: hashToken(token),
    label,
    enrolledVia: via,
    enrolledByProfileId: byProfileId,
    createdAt: ts.toISOString(),
    lastSeenAt: ts.toISOString(),
    expiresAt: expires.toISOString(),
    revokedAt: null,
  };
  db().insert(device).values(row).run();
  ctx.setCookie(DEVICE_COOKIE, token, { maxAgeSec: DEVICE_TTL_DAYS * 86_400 });
  return row;
}

export function currentDevice(ctx: Ctx): DeviceRow | null {
  const token = ctx.getCookie(DEVICE_COOKIE);
  if (!token) return null;
  const row = db().select().from(device).where(eq(device.tokenHash, hashToken(token))).get();
  if (!row || row.revokedAt || Date.parse(row.expiresAt) <= now().getTime()) return null;
  db().update(device).set({ lastSeenAt: now().toISOString() }).where(eq(device.id, row.id)).run();
  return row;
}

export function requireDevice(ctx: Ctx): DeviceRow {
  const row = currentDevice(ctx);
  if (!row) throw new ApiError('DEVICE_NOT_ENROLLED');
  return row;
}

export async function issuePairingCode(profileId: string): Promise<{ code: string; expiresAt: string }> {
  const code = generatePairingCode();
  const ts = now();
  const expiresAt = new Date(ts.getTime() + PAIRING_TTL_MIN * 60_000).toISOString();
  db()
    .insert(pairingCode)
    .values({ codeHash: await hashSecret(code), issuedByProfileId: profileId, expiresAt, createdAt: ts.toISOString() })
    .run();
  return { code, expiresAt };
}

/** Consumes a valid, unexpired, unused pairing code. Returns the issuing profile id or null. */
export async function redeemPairingCode(ctx: Ctx, code: string): Promise<string | null> {
  checkRateLimit('pairing', ctx.ip);
  const normalized = normalizeCode(code);
  const candidates = db().select().from(pairingCode).where(isNull(pairingCode.usedAt)).all();
  for (const c of candidates) {
    if (Date.parse(c.expiresAt) <= now().getTime()) continue;
    if (await verifySecret(c.codeHash, normalized)) {
      db()
        .update(pairingCode)
        .set({ usedAt: now().toISOString() })
        .where(and(eq(pairingCode.codeHash, c.codeHash), isNull(pairingCode.usedAt)))
        .run();
      clearRateLimit('pairing', ctx.ip);
      return c.issuedByProfileId;
    }
  }
  registerRateFailure('pairing', ctx.ip);
  return null;
}

export function listDevices(): Pick<DeviceRow, 'id' | 'label' | 'enrolledVia' | 'createdAt' | 'lastSeenAt'>[] {
  return db()
    .select({
      id: device.id,
      label: device.label,
      enrolledVia: device.enrolledVia,
      createdAt: device.createdAt,
      lastSeenAt: device.lastSeenAt,
    })
    .from(device)
    .where(isNull(device.revokedAt))
    .all();
}

export function revokeDevice(id: string): void {
  const res = db().update(device).set({ revokedAt: now().toISOString() }).where(and(eq(device.id, id), isNull(device.revokedAt))).run();
  if (res.changes === 0) throw new ApiError('NOT_FOUND');
}
