/** Client-side shapes of API responses (contracts/http-api.md). */
import type { Nutrients, Occasion, OptionalNutrient } from '@/domain/types';

export interface FoodSummary {
  id: string;
  nameEs: string;
  nameEn: string | null;
  category: string;
  preparationState: 'raw' | 'cooked' | 'prepared' | 'packaged';
  brand: string | null;
  basis: 'g' | 'ml';
  kcalPer100: number;
  proteinPer100: number;
  carbsPer100: number;
  fatPer100: number;
  densityGPerMl: number | null;
  source: string;
  isFavorite: boolean;
  isCustom: boolean;
  hasOverride: boolean;
}

export interface EntryView {
  id: string;
  mealId: string;
  foodId: string;
  name: string;
  brand: string | null;
  preparationState: FoodSummary['preparationState'];
  source: string;
  quantity: number;
  unit: 'g' | 'ml';
  approximate: boolean;
  eatenAt: string;
  note: string | null;
  nutrients: Nutrients;
  per100: { basis: 'g' | 'ml'; densityGPerMl: number | null; kcal: number; proteinG: number; carbsG: number; fatG: number };
}

export interface MealView {
  id: string;
  occasion: Occasion;
  label: string | null;
  entries: EntryView[];
  totals: Nutrients;
}

export interface ActivityView {
  id: string;
  activityTypeId: string;
  name: string;
  durationMin: number;
  intensity: 'light' | 'moderate' | 'vigorous' | null;
  estimateMethod: 'met' | 'manual' | 'none';
  metUsed: number | null;
  netKcal: number;
  note: string | null;
}

export interface DayEstimates {
  bmrKcal: number;
  baselineTdeeKcal: number;
  activityMultiplier: number;
  activityNetKcal: number;
  expenditureKcal: number;
  balanceKcal: number;
  balanceLabel: 'deficit' | 'surplus' | 'maintenance';
  formula: 'mifflin_st_jeor' | 'harris_benedict_revised';
  adjustmentKcal: number;
  snapshot: { settingsVersionId: string; effectiveFrom: string; weightKg: number; age: number; calcVersion: number; frozen: boolean } | null;
  inputs: { weightKg: number; age: number; effectiveFrom: string };
  isEstimate: true;
}

export interface DaySummary {
  date: string;
  status: string | null;
  foodCompleted: boolean | null;
  meals: MealView[];
  activities: ActivityView[];
  totals: Nutrients;
  incompleteNutrients: OptionalNutrient[];
  target: {
    activeKcal: number;
    recommendedKcal: number;
    isOverride: boolean;
    proteinG: number | null;
    carbsG: number | null;
    fatG: number | null;
    remainingKcal: number;
  };
  estimates: DayEstimates | null;
  xpAwarded?: { source: string; amount: number }[];
  flags?: { restDay: boolean; markedComplete: boolean };
}

export interface MeLite {
  profile: { id: string; name: string; weightUnit: 'kg' | 'lb'; heightUnit: 'cm' | 'ft_in'; foodUnit: 'metric' | 'imperial'; timeZone: string };
  settings: { goalType: 'gain' | 'loss' | 'maintenance'; heightCm: number; sexForFormula: 'male' | 'female' | 'unspecified' };
  currentWeightKg: number;
}
