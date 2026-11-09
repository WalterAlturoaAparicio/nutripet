/**
 * Energy estimates (FR-010–FR-018, research.md R8). Every result is an estimate.
 * Sign convention: balance = expenditure − intake; positive = estimated deficit.
 */
import {
  ACTIVITY_MULTIPLIERS,
  MAX_ADJUSTMENT_RATIO,
  MIFFLIN_SEX_CONSTANT,
  RESTING_MET,
  SAFETY_FLOOR_KCAL,
} from '../config';
import type { ActivityLevel, BalanceLabel, BmrFormula, LocalDate, Sex } from '../types';

export function ageOn(birthDate: LocalDate, date: LocalDate): number {
  const [by, bm, bd] = birthDate.split('-').map(Number) as [number, number, number];
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age -= 1;
  return age;
}

export interface BmrInput {
  formula: BmrFormula;
  sex: Sex;
  weightKg: number;
  heightCm: number;
  age: number;
}

function harrisBenedict(sex: 'male' | 'female', kg: number, cm: number, age: number): number {
  return sex === 'male'
    ? 88.362 + 13.397 * kg + 4.799 * cm - 5.677 * age
    : 447.593 + 9.247 * kg + 3.098 * cm - 4.33 * age;
}

/** Basal metabolic rate (kcal/day). Mifflin-St Jeor by default; Harris-Benedict revised (Roza & Shizgal 1984). */
export function bmr({ formula, sex, weightKg, heightCm, age }: BmrInput): number {
  if (formula === 'harris_benedict_revised') {
    if (sex === 'unspecified') {
      return (harrisBenedict('male', weightKg, heightCm, age) + harrisBenedict('female', weightKg, heightCm, age)) / 2;
    }
    return harrisBenedict(sex, weightKg, heightCm, age);
  }
  return 10 * weightKg + 6.25 * heightCm - 5 * age + MIFFLIN_SEX_CONSTANT[sex];
}

export function activityMultiplier(level: ActivityLevel): number {
  return ACTIVITY_MULTIPLIERS[level];
}

/** Daily expenditure without logged exercise: the multiplier describes non-exercise daily life. */
export function baselineTdee(bmrKcal: number, multiplier: number): number {
  return bmrKcal * multiplier;
}

/** Recommended target = baseline TDEE + adjustment. Logged exercise never changes it (FR-013). */
export function recommendedTarget(baselineTdeeKcal: number, adjustmentKcal: number): number {
  return baselineTdeeKcal + adjustmentKcal;
}

export type TargetCaution = 'target_below_safety' | 'adjustment_over_25pct';

export function targetCaution(input: {
  target: number;
  bmr: number;
  baselineTdee: number;
  adjustmentKcal: number;
}): TargetCaution | null {
  if (input.target < Math.max(input.bmr, SAFETY_FLOOR_KCAL)) return 'target_below_safety';
  if (Math.abs(input.adjustmentKcal) > MAX_ADJUSTMENT_RATIO * input.baselineTdee) return 'adjustment_over_25pct';
  return null;
}

export interface EnergyProfile {
  formula: BmrFormula;
  bmrKcal: number;
  activityMultiplier: number;
  baselineTdeeKcal: number;
  adjustmentKcal: number;
  recommendedTargetKcal: number;
  activeTargetKcal: number;
  targetIsOverride: boolean;
  caution?: TargetCaution;
  isEstimate: true;
}

export function energyProfile(input: BmrInput & {
  activityMultiplier: number;
  adjustmentKcal: number;
  overrideKcal: number | null;
}): EnergyProfile {
  const b = bmr(input);
  const tdee = baselineTdee(b, input.activityMultiplier);
  const recommended = recommendedTarget(tdee, input.adjustmentKcal);
  const active = input.overrideKcal ?? recommended;
  const caution = targetCaution({ target: active, bmr: b, baselineTdee: tdee, adjustmentKcal: input.adjustmentKcal });
  return {
    formula: input.formula,
    bmrKcal: b,
    activityMultiplier: input.activityMultiplier,
    baselineTdeeKcal: tdee,
    adjustmentKcal: input.adjustmentKcal,
    recommendedTargetKcal: recommended,
    activeTargetKcal: active,
    targetIsOverride: input.overrideKcal !== null,
    ...(caution ? { caution } : {}),
    isEstimate: true,
  };
}

/** Net energy of an activity above resting: (MET − 1) × kg × hours, never negative (FR-042). */
export function activityNetKcal({ met, weightKg, durationMin }: { met: number; weightKg: number; durationMin: number }): number {
  return Math.max(0, (met - RESTING_MET) * weightKg * (durationMin / 60));
}

export function balanceLabel(balanceKcal: number): BalanceLabel {
  if (balanceKcal > 0) return 'deficit';
  if (balanceKcal < 0) return 'surplus';
  return 'maintenance';
}

export interface DailyEnergy {
  expenditureKcal: number;
  activityNetKcal: number;
  balanceKcal: number;
  balanceLabel: BalanceLabel;
}

/** Estimated expenditure = baseline TDEE + net activity; balance = expenditure − intake (FR-012, FR-016). */
export function dailyEnergy({
  baselineTdee: base,
  activityNetKcal: activities,
  intakeKcal,
}: {
  baselineTdee: number;
  activityNetKcal: number[];
  intakeKcal: number;
}): DailyEnergy {
  const activity = activities.reduce((s, k) => s + k, 0);
  const expenditure = base + activity;
  const balance = expenditure - intakeKcal;
  return { expenditureKcal: expenditure, activityNetKcal: activity, balanceKcal: balance, balanceLabel: balanceLabel(balance) };
}
