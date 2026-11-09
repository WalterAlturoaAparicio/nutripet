import { expect } from 'vitest';
import { POST as createProfileRoute } from '@/app/api/v1/profiles/route';
import { POST as loginRoute } from '@/app/api/v1/session/route';
import { hashToken, randomToken } from '@/server/auth/tokens';
import { device } from '@/server/db/schema';
import { db } from '@/server/db/client';
import { newId } from '@/server/db/ids';
import { now } from '@/server/clock';
import { call, type Jar } from './db';

/** Cookie jar for an enrolled device. */
export function asDevice(jar: Jar = {}): Jar {
  const token = randomToken();
  const ts = now();
  db()
    .insert(device)
    .values({
      id: newId(),
      tokenHash: hashToken(token),
      label: 'test',
      enrolledVia: 'setup_token',
      enrolledByProfileId: null,
      createdAt: ts.toISOString(),
      lastSeenAt: ts.toISOString(),
      expiresAt: new Date(ts.getTime() + 86_400_000 * 30).toISOString(),
      revokedAt: null,
    })
    .run();
  return { ...jar, np_device: token };
}

export const profileA = {
  name: 'Ana',
  birthDate: '1996-11-05',
  sexForFormula: 'male' as const,
  heightCm: 180,
  weightKg: 80,
  targetWeightKg: 86,
  goalType: 'gain' as const,
  activityLevel: 'moderate' as const,
  calorieAdjustmentKcal: 300,
  pin: '1234',
};

export const profileB = {
  name: 'Bruno',
  birthDate: '1998-03-10',
  sexForFormula: 'female' as const,
  heightCm: 165,
  weightKg: 65,
  targetWeightKg: 60,
  goalType: 'loss' as const,
  activityLevel: 'light' as const,
  calorieAdjustmentKcal: -400,
  pin: '5678',
};

export interface CreatedProfile {
  id: string;
  jar: Jar;
  recoveryCode: string;
}

/** Creates A during initial setup (device enrolled), then B from A's session. Returns both sessions. */
export async function setupTwoProfiles(): Promise<{ a: CreatedProfile; b: CreatedProfile; deviceJar: Jar }> {
  const ra = await call(createProfileRoute, { body: profileA });
  expect(ra.status).toBe(201);
  const rb = await call(createProfileRoute, { body: profileB, jar: ra.jar });
  expect(rb.status).toBe(201);
  const deviceJar = { np_device: ra.jar.np_device! };
  return {
    a: { id: ra.body.profile.id, jar: { ...deviceJar, np_session: ra.jar.np_session! }, recoveryCode: ra.body.recoveryCode },
    b: { id: rb.body.profile.id, jar: rb.jar, recoveryCode: rb.body.recoveryCode },
    deviceJar,
  };
}

export async function createOne(body: Record<string, unknown> = profileA): Promise<CreatedProfile> {
  const r = await call(createProfileRoute, { body });
  expect(r.status).toBe(201);
  return { id: r.body.profile.id, jar: r.jar, recoveryCode: r.body.recoveryCode };
}

export async function loginAs(deviceJar: Jar, profileId: string, pin: string) {
  return call(loginRoute, { body: { profileId, pin }, jar: deviceJar });
}
