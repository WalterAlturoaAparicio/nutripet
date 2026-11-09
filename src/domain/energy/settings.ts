/**
 * Effective-dated settings and day energy snapshots (FR-019, research.md R7b).
 * Past days are computed only from their frozen snapshot, so history stays reproducible.
 */
import { CALC_VERSION } from '../config';
import type { DayEnergySnapshot, LocalDate, SettingsVersion, WeightRecordLike } from '../types';
import { ageOn, baselineTdee, bmr, dailyEnergy, recommendedTarget, type DailyEnergy } from './index';

const byEffectiveThenCreated = (a: SettingsVersion, b: SettingsVersion) =>
  a.effectiveFrom === b.effectiveFrom ? a.createdAt.localeCompare(b.createdAt) : a.effectiveFrom.localeCompare(b.effectiveFrom);

/** The version with the greatest effectiveFrom ≤ date (ties: latest createdAt); dates before v1 resolve to v1. */
export function effectiveSettings(versions: SettingsVersion[], date: LocalDate): SettingsVersion {
  if (versions.length === 0) throw new Error('No settings versions');
  const sorted = [...versions].sort(byEffectiveThenCreated);
  let chosen = sorted[0]!;
  for (const v of sorted) if (v.effectiveFrom <= date) chosen = v;
  return chosen;
}

const byDateThenCreated = (a: WeightRecordLike, b: WeightRecordLike) =>
  a.localDate === b.localDate ? a.createdAt.localeCompare(b.createdAt) : a.localDate.localeCompare(b.localDate);

/** Latest weight record on or before `date` (ties: latest createdAt); else the earliest record. */
export function weightForDate(records: WeightRecordLike[], date: LocalDate): { weightKg: number; recordId: string } {
  if (records.length === 0) throw new Error('No weight records');
  const sorted = [...records].sort(byDateThenCreated);
  let chosen = sorted[0]!;
  for (const r of sorted) if (r.localDate <= date) chosen = r;
  return { weightKg: chosen.weightKg, recordId: chosen.id };
}

export function buildDayEnergySnapshot({
  settings,
  weight,
  date,
  calcVersion = CALC_VERSION,
}: {
  settings: SettingsVersion;
  weight: { weightKg: number; recordId: string };
  date: LocalDate;
  calcVersion?: number;
}): DayEnergySnapshot {
  const age = ageOn(settings.birthDate, date);
  const b = bmr({
    formula: settings.bmrFormula,
    sex: settings.sexForFormula,
    weightKg: weight.weightKg,
    heightCm: settings.heightCm,
    age,
  });
  const tdee = baselineTdee(b, settings.activityMultiplier);
  const recommended = recommendedTarget(tdee, settings.calorieAdjustmentKcal);
  return {
    localDate: date,
    settingsVersionId: settings.id,
    weightKg: weight.weightKg,
    weightRecordId: weight.recordId,
    age,
    bmrKcal: b,
    activityMultiplier: settings.activityMultiplier,
    baselineTdeeKcal: tdee,
    adjustmentKcal: settings.calorieAdjustmentKcal,
    recommendedTargetKcal: recommended,
    activeTargetKcal: settings.calorieTargetOverrideKcal ?? recommended,
    targetIsOverride: settings.calorieTargetOverrideKcal !== null,
    proteinTargetG: settings.proteinTargetG,
    carbsTargetG: settings.carbsTargetG,
    fatTargetG: settings.fatTargetG,
    bmrFormula: settings.bmrFormula,
    calcVersion,
  };
}

export function dayEnergyFromSnapshot(
  snapshot: DayEnergySnapshot,
  activityNetKcal: number[],
  intakeKcal: number,
): DailyEnergy {
  return dailyEnergy({ baselineTdee: snapshot.baselineTdeeKcal, activityNetKcal, intakeKcal });
}
