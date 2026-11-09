/**
 * Day energy snapshots (FR-019). A day's snapshot is created on its first food or activity record
 * and never modified once the date is in the past; only today's snapshot is refreshed after a
 * settings change made today.
 */
import { and, asc, eq } from 'drizzle-orm';
import { buildDayEnergySnapshot, effectiveSettings, weightForDate } from '@/domain/energy/settings';
import type { DayEnergySnapshot, LocalDate, SettingsVersion, WeightRecordLike } from '@/domain/types';
import { db } from '../../db/client';
import { dayEnergySnapshot, profile, profileSettingsVersion, weightRecord } from '../../db/schema';
import { nowIso, todayIn } from '../../clock';

type SnapshotRow = typeof dayEnergySnapshot.$inferSelect;
type VersionRow = typeof profileSettingsVersion.$inferSelect;

export function toSettingsVersion(r: VersionRow): SettingsVersion {
  return {
    id: r.id,
    effectiveFrom: r.effectiveFrom,
    createdAt: r.createdAt,
    birthDate: r.birthDate,
    sexForFormula: r.sexForFormula,
    heightCm: r.heightCm,
    goalType: r.goalType,
    activityLevel: r.activityLevel,
    activityMultiplier: r.activityMultiplier,
    bmrFormula: r.bmrFormula,
    calorieAdjustmentKcal: r.calorieAdjustmentKcal,
    calorieTargetOverrideKcal: r.calorieTargetOverrideKcal,
    proteinTargetG: r.proteinTargetG,
    carbsTargetG: r.carbsTargetG,
    fatTargetG: r.fatTargetG,
    calcVersion: r.calcVersion,
  };
}

function toSnapshot(r: SnapshotRow): DayEnergySnapshot {
  return {
    localDate: r.localDate,
    settingsVersionId: r.settingsVersionId,
    weightKg: r.weightKg,
    weightRecordId: r.weightRecordId,
    age: r.age,
    bmrKcal: r.bmrKcal,
    activityMultiplier: r.activityMultiplier,
    baselineTdeeKcal: r.baselineTdeeKcal,
    adjustmentKcal: r.adjustmentKcal,
    recommendedTargetKcal: r.recommendedTargetKcal,
    activeTargetKcal: r.activeTargetKcal,
    targetIsOverride: r.targetIsOverride,
    proteinTargetG: r.proteinTargetG,
    carbsTargetG: r.carbsTargetG,
    fatTargetG: r.fatTargetG,
    bmrFormula: r.bmrFormula,
    calcVersion: r.calcVersion,
  };
}

export function settingsVersions(profileId: string): SettingsVersion[] {
  return db()
    .select()
    .from(profileSettingsVersion)
    .where(eq(profileSettingsVersion.profileId, profileId))
    .orderBy(asc(profileSettingsVersion.effectiveFrom), asc(profileSettingsVersion.createdAt))
    .all()
    .map(toSettingsVersion);
}

export function weightRecords(profileId: string): WeightRecordLike[] {
  return db()
    .select({ id: weightRecord.id, localDate: weightRecord.localDate, weightKg: weightRecord.weightKg, createdAt: weightRecord.createdAt })
    .from(weightRecord)
    .where(eq(weightRecord.profileId, profileId))
    .all();
}

function profileTimeZone(profileId: string): string {
  return db().select({ tz: profile.timeZone }).from(profile).where(eq(profile.id, profileId)).get()?.tz ?? 'America/Bogota';
}

function computeSnapshot(profileId: string, date: LocalDate): DayEnergySnapshot {
  return buildDayEnergySnapshot({
    settings: effectiveSettings(settingsVersions(profileId), date),
    weight: weightForDate(weightRecords(profileId), date),
    date,
  });
}

function storedSnapshot(profileId: string, date: LocalDate): SnapshotRow | undefined {
  return db()
    .select()
    .from(dayEnergySnapshot)
    .where(and(eq(dayEnergySnapshot.profileId, profileId), eq(dayEnergySnapshot.localDate, date)))
    .get();
}

/** Creates the day's snapshot if it does not exist yet (idempotent). */
export function ensureDaySnapshot(profileId: string, date: LocalDate): DayEnergySnapshot {
  const existing = storedSnapshot(profileId, date);
  if (existing) return toSnapshot(existing);
  const snap = computeSnapshot(profileId, date);
  db()
    .insert(dayEnergySnapshot)
    .values({ profileId, ...snap, createdAt: nowIso(), refreshedAt: null })
    .onConflictDoNothing()
    .run();
  return toSnapshot(storedSnapshot(profileId, date)!);
}

export interface DayEnergy {
  snapshot: DayEnergySnapshot;
  /** True when the values come from a stored snapshot. */
  persisted: boolean;
  /** True for stored snapshots of past days (they never change). */
  frozen: boolean;
  effectiveFrom: LocalDate;
}

/** Stored snapshot if present; otherwise computed on the fly (not persisted). */
export function getDayEnergy(profileId: string, date: LocalDate): DayEnergy {
  const versions = settingsVersions(profileId);
  const row = storedSnapshot(profileId, date);
  const snapshot = row ? toSnapshot(row) : computeSnapshot(profileId, date);
  const version = versions.find((v) => v.id === snapshot.settingsVersionId) ?? effectiveSettings(versions, date);
  const today = todayIn(profileTimeZone(profileId));
  return { snapshot, persisted: Boolean(row), frozen: Boolean(row) && date < today, effectiveFrom: version.effectiveFrom };
}

/** Rebuilds today's stored snapshot after a settings (or today's weight) change. Past days are untouched. */
export function refreshTodaySnapshot(profileId: string): void {
  const today = todayIn(profileTimeZone(profileId));
  if (!storedSnapshot(profileId, today)) return;
  const snap = computeSnapshot(profileId, today);
  db()
    .update(dayEnergySnapshot)
    .set({ ...snap, refreshedAt: nowIso() })
    .where(and(eq(dayEnergySnapshot.profileId, profileId), eq(dayEnergySnapshot.localDate, today)))
    .run();
}
