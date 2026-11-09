/** Shared domain types. Names match specs/001-nutripet-mvp/data-model.md. */

/** ISO local date `YYYY-MM-DD` in a profile's time zone. */
export type LocalDate = string;

export type Basis = 'g' | 'ml';
export type QuantityUnit = 'g' | 'ml';
export type PreparationState = 'raw' | 'cooked' | 'prepared' | 'packaged';

export type Occasion = 'breakfast' | 'morning_snack' | 'lunch' | 'afternoon_snack' | 'dinner' | 'extra';
export const OCCASIONS: readonly Occasion[] = [
  'breakfast',
  'morning_snack',
  'lunch',
  'afternoon_snack',
  'dinner',
  'extra',
];

export type GoalType = 'gain' | 'loss' | 'maintenance';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'high' | 'very_high';
export type Sex = 'male' | 'female' | 'unspecified';
export type BmrFormula = 'mifflin_st_jeor' | 'harris_benedict_revised';
export type Intensity = 'light' | 'moderate' | 'vigorous';
export type EstimateMethod = 'met' | 'manual' | 'none';

/** Nutrient values per 100 g or 100 ml of a food's basis. Optional nutrients are null when unknown. */
export interface NutrientsPer100 {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
  sugarG: number | null;
  sodiumMg: number | null;
}

/** Absolute nutrient amounts. Optional nutrients are null when unknown. */
export interface Nutrients {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
  sugarG: number | null;
  sodiumMg: number | null;
}

export type OptionalNutrient = 'fiber' | 'sugar' | 'sodium';

export type DayStatus =
  | 'none'
  | 'activity_only'
  | 'food_partial'
  | 'food_completed'
  | 'full_completed'
  | 'rest_completed';

export type PetStage = 'newborn' | 'young' | 'adolescent' | 'adult' | 'special';
export const PET_STAGES: readonly PetStage[] = ['newborn', 'young', 'adolescent', 'adult', 'special'];

export type XpSource =
  | 'food_entry'
  | 'food_day'
  | 'activity'
  | 'activity_bonus'
  | 'weight'
  | 'streak'
  | 'milestone';

export type BalanceLabel = 'deficit' | 'surplus' | 'maintenance';

/** Effective-dated, energy-relevant profile settings (FR-019). */
export interface SettingsVersion {
  id: string;
  effectiveFrom: LocalDate;
  createdAt: string;
  birthDate: LocalDate;
  sexForFormula: Sex;
  heightCm: number;
  goalType: GoalType;
  activityLevel: ActivityLevel;
  activityMultiplier: number;
  bmrFormula: BmrFormula;
  calorieAdjustmentKcal: number;
  calorieTargetOverrideKcal: number | null;
  proteinTargetG: number | null;
  carbsTargetG: number | null;
  fatTargetG: number | null;
  calcVersion: number;
}

export interface WeightRecordLike {
  id: string;
  localDate: LocalDate;
  weightKg: number;
  createdAt: string;
}

/** Frozen energy inputs and results for one profile and one day (FR-019). */
export interface DayEnergySnapshot {
  localDate: LocalDate;
  settingsVersionId: string;
  weightKg: number;
  weightRecordId: string;
  age: number;
  bmrKcal: number;
  activityMultiplier: number;
  baselineTdeeKcal: number;
  adjustmentKcal: number;
  recommendedTargetKcal: number;
  activeTargetKcal: number;
  targetIsOverride: boolean;
  proteinTargetG: number | null;
  carbsTargetG: number | null;
  fatTargetG: number | null;
  bmrFormula: BmrFormula;
  calcVersion: number;
}
