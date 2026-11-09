import { asc, desc, eq } from 'drizzle-orm';
import { CALC_VERSION, DEFAULT_ADJUSTMENT_KCAL } from '@/domain/config';
import { ageOn, activityMultiplier, energyProfile, type EnergyProfile } from '@/domain/energy';
import { effectiveSettings } from '@/domain/energy/settings';
import { isFuture } from '@/domain/dates';
import type { SettingsVersion } from '@/domain/types';
import { db, tx } from '../../db/client';
import { profile, profileSettingsVersion, weightRecord } from '../../db/schema';
import { newId } from '../../db/ids';
import { nowIso, todayIn } from '../../clock';
import { ApiError, confirmRequired, notFound } from '../../http/errors';
import type { Ctx } from '../../http/handler';
import { env } from '../../env';
import { createSession, destroyAllSessions, readSession } from '../../auth/session';
import { currentDevice, enrollDevice, requireDevice } from '../../auth/device';
import { creationAuthority } from '../../auth/setup-token';
import { generateRecoveryCode, hashSecret, normalizeCode, verifySecret } from '../../auth/pin';
import { checkLocked, registerFailure, registerSuccess } from '../../auth/lockout';
import type { ProfileRow } from '../../auth/require-profile';
import {
  adjustmentMatchesGoal,
  ENERGY_FIELDS,
  PROFILE_FIELDS,
  type CreateProfileInput,
  type UpdateProfileInput,
} from '../../validation/profile';
import { refreshTodaySnapshot, settingsVersions, toSettingsVersion } from '../day-energy/service';
import { lookupPets, runProfileCreatedHooks } from './hooks';
import '../register';

export interface PublicProfile {
  id: string;
  name: string;
  targetWeightKg: number;
  weightUnit: 'kg' | 'lb';
  heightUnit: 'cm' | 'ft_in';
  foodUnit: 'metric' | 'imperial';
  timeZone: string;
  createdAt: string;
}

export function publicProfile(p: ProfileRow): PublicProfile {
  return {
    id: p.id,
    name: p.name,
    targetWeightKg: p.targetWeightKg,
    weightUnit: p.weightUnit,
    heightUnit: p.heightUnit,
    foodUnit: p.foodUnit,
    timeZone: p.timeZone,
    createdAt: p.createdAt,
  };
}

function getProfileRow(profileId: string): ProfileRow {
  const row = db().select().from(profile).where(eq(profile.id, profileId)).get();
  if (!row) throw notFound();
  return row;
}

function latestWeightKg(profileId: string, onOrBefore?: string): number {
  const rows = db()
    .select()
    .from(weightRecord)
    .where(eq(weightRecord.profileId, profileId))
    .orderBy(desc(weightRecord.localDate), desc(weightRecord.createdAt))
    .all();
  const row = (onOrBefore ? rows.find((r) => r.localDate <= onOrBefore) : undefined) ?? rows[0];
  if (!row) throw new ApiError('CONFLICT', 'Registra tu peso para calcular tus estimaciones.', { reason: 'no_weight' });
  return row.weightKg;
}

function energyFor(settings: SettingsVersion, weightKg: number, date: string): EnergyProfile & { calcVersion: number } {
  return {
    ...energyProfile({
      formula: settings.bmrFormula,
      sex: settings.sexForFormula,
      weightKg,
      heightCm: settings.heightCm,
      age: ageOn(settings.birthDate, date),
      activityMultiplier: settings.activityMultiplier,
      adjustmentKcal: settings.calorieAdjustmentKcal,
      overrideKcal: settings.calorieTargetOverrideKcal,
    }),
    calcVersion: settings.calcVersion,
  };
}

function checkAge(birthDate: string, today: string): void {
  if (isFuture(birthDate, today)) throw new ApiError('VALIDATION', undefined, { fields: { birthDate: 'Fecha inválida.' } });
  const age = ageOn(birthDate, today);
  if (age < 14 || age > 100) {
    throw new ApiError('VALIDATION', undefined, { fields: { birthDate: 'La edad debe estar entre 14 y 100 años.' } });
  }
}

function isUniqueNameError(err: unknown): boolean {
  return err instanceof Error && /UNIQUE constraint failed/.test(err.message) && /profile/.test(err.message);
}

const nameTaken = () => new ApiError('VALIDATION', undefined, { fields: { name: 'Ya existe un perfil con ese nombre.' } });

/** FR-001, FR-002, FR-008: creates profile + first weight + settings v1 atomically. */
export async function createProfile(ctx: Ctx, input: CreateProfileInput) {
  const sessionProfileId = readSession(ctx);
  const authority = creationAuthority(ctx, sessionProfileId, input.setupToken);
  if (!authority) throw new ApiError('FORBIDDEN', 'Para crear otro perfil entra con un perfil existente o usa el token de configuración.');

  const timeZone = input.timeZone ?? env().APP_TIMEZONE_DEFAULT;
  const today = todayIn(timeZone);
  checkAge(input.birthDate, today);

  const adjustment = input.calorieAdjustmentKcal ?? DEFAULT_ADJUSTMENT_KCAL[input.goalType];
  const settings: Omit<SettingsVersion, 'id' | 'createdAt'> = {
    effectiveFrom: today,
    birthDate: input.birthDate,
    sexForFormula: input.sexForFormula,
    heightCm: input.heightCm,
    goalType: input.goalType,
    activityLevel: input.activityLevel,
    activityMultiplier: activityMultiplier(input.activityLevel),
    bmrFormula: input.bmrFormula ?? 'mifflin_st_jeor',
    calorieAdjustmentKcal: adjustment,
    calorieTargetOverrideKcal: input.calorieTargetOverrideKcal ?? null,
    proteinTargetG: input.proteinTargetG ?? null,
    carbsTargetG: input.carbsTargetG ?? null,
    fatTargetG: input.fatTargetG ?? null,
    calcVersion: CALC_VERSION,
  };
  const energy = energyFor({ ...settings, id: 'new', createdAt: '' }, input.weightKg, today);
  if (energy.caution && !input.confirm) throw confirmRequired(energy.caution);

  const recoveryCode = generateRecoveryCode();
  const [pinHash, recoveryCodeHash] = await Promise.all([hashSecret(input.pin), hashSecret(normalizeCode(recoveryCode))]);
  const ts = nowIso();
  const profileId = newId();

  try {
    tx((d) => {
      d.insert(profile)
        .values({
          id: profileId,
          name: input.name,
          targetWeightKg: input.targetWeightKg,
          weightUnit: input.weightUnit ?? 'kg',
          heightUnit: input.heightUnit ?? 'cm',
          foodUnit: input.foodUnit ?? 'metric',
          timeZone,
          pinHash,
          recoveryCodeHash,
          createdAt: ts,
          updatedAt: ts,
        })
        .run();
      d.insert(weightRecord)
        .values({ id: newId(), profileId, localDate: today, weightKg: input.weightKg, note: null, createdAt: ts, updatedAt: ts })
        .run();
      d.insert(profileSettingsVersion).values({ id: newId(), profileId, createdAt: ts, ...settings }).run();
      runProfileCreatedHooks(d, profileId, { petName: input.petName });
    });
  } catch (err) {
    if (isUniqueNameError(err)) throw nameTaken();
    throw err;
  }

  // Initial setup and setup-token creation also enroll this device so the selector works here.
  if (authority !== 'session' && !currentDevice(ctx)) {
    enrollDevice(ctx, authority === 'initial_setup' ? 'initial_setup' : 'setup_token', `Dispositivo de ${input.name}`);
  }
  // The person who just created the profile continues as that profile.
  createSession(ctx, profileId);
  return { profile: publicProfile(getProfileRow(profileId)), recoveryCode };
}

export function currentSettings(profileId: string, today: string): SettingsVersion {
  return effectiveSettings(settingsVersions(profileId), today);
}

export function getMe(profileId: string) {
  const p = getProfileRow(profileId);
  const today = todayIn(p.timeZone);
  const settings = currentSettings(profileId, today);
  const weightKg = latestWeightKg(profileId, today);
  return { profile: publicProfile(p), currentWeightKg: weightKg, settings, energy: energyFor(settings, weightKg, today) };
}

/** FR-003, FR-019: profile fields update in place; energy fields create a settings version effective today. */
export function updateMe(profileId: string, input: UpdateProfileInput) {
  const p = getProfileRow(profileId);
  const profilePatch = Object.fromEntries(
    PROFILE_FIELDS.filter((k) => input[k] !== undefined).map((k) => [k, input[k]]),
  ) as Partial<ProfileRow>;
  const energyPatch = Object.fromEntries(
    ENERGY_FIELDS.filter((k) => input[k] !== undefined).map((k) => [k, input[k]]),
  ) as Partial<SettingsVersion>;

  const timeZone = profilePatch.timeZone ?? p.timeZone;
  const today = todayIn(timeZone);
  const current = currentSettings(profileId, today);

  const changed = (Object.keys(energyPatch) as (keyof SettingsVersion)[]).filter((k) => energyPatch[k] !== current[k]);
  let next: SettingsVersion | null = null;
  if (changed.length > 0) {
    const merged = { ...current, ...energyPatch };
    // Changing the goal without an explicit adjustment resets it to that goal's default.
    if (energyPatch.goalType && energyPatch.calorieAdjustmentKcal === undefined && energyPatch.goalType !== current.goalType) {
      merged.calorieAdjustmentKcal = DEFAULT_ADJUSTMENT_KCAL[energyPatch.goalType];
    }
    if (!adjustmentMatchesGoal(merged.goalType, merged.calorieAdjustmentKcal)) {
      throw new ApiError('VALIDATION', undefined, {
        fields: { calorieAdjustmentKcal: 'El ajuste debe ser positivo para subir, negativo para bajar y 0 para mantener.' },
      });
    }
    if (energyPatch.birthDate) checkAge(merged.birthDate, today);
    merged.activityMultiplier = activityMultiplier(merged.activityLevel);
    const energy = energyFor(merged, latestWeightKg(profileId, today), today);
    if (energy.caution && !input.confirm) throw confirmRequired(energy.caution);
    next = { ...merged, id: newId(), effectiveFrom: today, createdAt: nowIso(), calcVersion: CALC_VERSION };
  }

  try {
    tx((d) => {
      if (Object.keys(profilePatch).length > 0) {
        d.update(profile).set({ ...profilePatch, updatedAt: nowIso() }).where(eq(profile.id, profileId)).run();
      }
      if (next) {
        const { id, effectiveFrom, createdAt, ...rest } = next;
        d.insert(profileSettingsVersion).values({ id, profileId, effectiveFrom, createdAt, ...rest }).run();
      }
    });
  } catch (err) {
    if (isUniqueNameError(err)) throw nameTaken();
    throw err;
  }
  if (next) refreshTodaySnapshot(profileId);
  return { ...getMe(profileId), appliedFrom: next ? today : null };
}

export function settingsHistory(profileId: string): SettingsVersion[] {
  return db()
    .select()
    .from(profileSettingsVersion)
    .where(eq(profileSettingsVersion.profileId, profileId))
    .orderBy(desc(profileSettingsVersion.effectiveFrom), desc(profileSettingsVersion.createdAt))
    .all()
    .map(toSettingsVersion);
}

/** FR-008: only enrolled devices see names. Pet fields stay null until US7 registers a lookup. */
export function listSelector(ctx: Ctx) {
  requireDevice(ctx);
  const rows = db().select({ id: profile.id, name: profile.name }).from(profile).orderBy(asc(profile.createdAt)).all();
  const pets = lookupPets(rows.map((r) => r.id));
  return rows.map((r) => ({ id: r.id, name: r.name, petStage: pets.get(r.id)?.petStage ?? null, petName: pets.get(r.id)?.petName ?? null }));
}

const wrongPin = () => new ApiError('UNAUTHENTICATED', 'PIN incorrecto.', { reason: 'wrong_pin' });

export async function login(ctx: Ctx, input: { profileId: string; pin: string }): Promise<void> {
  requireDevice(ctx);
  const row = db().select().from(profile).where(eq(profile.id, input.profileId)).get();
  if (!row) throw wrongPin();
  checkLocked(row, 'pin');
  if (!(await verifySecret(row.pinHash, input.pin))) {
    const sec = registerFailure(row, 'pin');
    if (sec) throw new ApiError('LOCKED', undefined, { retryAfterSec: sec, reason: 'pin' });
    throw wrongPin();
  }
  registerSuccess(row.id, ['pin']);
  createSession(ctx, row.id);
}

/** FR-004 / U1: recovery attempts use their own escalating lockout; success resets both counters. */
export async function resetPin(ctx: Ctx, profileId: string, input: { recoveryCode: string; newPin: string }) {
  requireDevice(ctx);
  const row = db().select().from(profile).where(eq(profile.id, profileId)).get();
  if (!row) throw new ApiError('VALIDATION', 'Código de recuperación incorrecto.');
  checkLocked(row, 'recovery');
  if (!(await verifySecret(row.recoveryCodeHash, normalizeCode(input.recoveryCode)))) {
    const sec = registerFailure(row, 'recovery');
    if (sec) throw new ApiError('LOCKED', undefined, { retryAfterSec: sec, reason: 'recovery' });
    throw new ApiError('VALIDATION', 'Código de recuperación incorrecto.', { reason: 'wrong_recovery_code' });
  }
  const recoveryCode = generateRecoveryCode();
  const [pinHash, recoveryCodeHash] = await Promise.all([hashSecret(input.newPin), hashSecret(normalizeCode(recoveryCode))]);
  db().update(profile).set({ pinHash, recoveryCodeHash, updatedAt: nowIso() }).where(eq(profile.id, profileId)).run();
  registerSuccess(profileId, ['pin', 'recovery']);
  destroyAllSessions(profileId);
  return { recoveryCode };
}
