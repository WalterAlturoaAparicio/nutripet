/** Display/input conversions only; storage is always metric (FR-006, FR-007). */

export type WeightUnit = 'kg' | 'lb';
export type HeightUnit = 'cm' | 'ft_in';
export type FoodUnit = 'metric' | 'imperial';

const KG_PER_LB = 0.45359237;
const CM_PER_IN = 2.54;
const G_PER_OZ = 28.349523125;
const ML_PER_FLOZ = 29.5735295625;

const nf0 = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1, minimumFractionDigits: 0 });

export const kgToDisplay = (kg: number, unit: WeightUnit) => (unit === 'lb' ? kg / KG_PER_LB : kg);
export const displayToKg = (value: number, unit: WeightUnit) => (unit === 'lb' ? value * KG_PER_LB : value);

export function formatWeight(kg: number, unit: WeightUnit): string {
  return `${nf1.format(kgToDisplay(kg, unit))} ${unit}`;
}

export function cmToFtIn(cm: number): { ft: number; inch: number } {
  const totalIn = cm / CM_PER_IN;
  const ft = Math.floor(totalIn / 12);
  return { ft, inch: Math.round((totalIn - ft * 12) * 10) / 10 };
}
export const ftInToCm = (ft: number, inch: number) => (ft * 12 + inch) * CM_PER_IN;

export function formatHeight(cm: number, unit: HeightUnit): string {
  if (unit === 'cm') return `${nf0.format(cm)} cm`;
  const { ft, inch } = cmToFtIn(cm);
  return `${ft} ft ${nf1.format(inch)} in`;
}

/** Quantity in g/ml shown in the profile's food unit. */
export function quantityToDisplay(value: number, unit: 'g' | 'ml', foodUnit: FoodUnit): { value: number; unit: string } {
  if (foodUnit === 'metric') return { value, unit };
  return unit === 'g' ? { value: value / G_PER_OZ, unit: 'oz' } : { value: value / ML_PER_FLOZ, unit: 'fl oz' };
}

export function displayToQuantity(value: number, unit: 'g' | 'ml', foodUnit: FoodUnit): number {
  if (foodUnit === 'metric') return value;
  return unit === 'g' ? value * G_PER_OZ : value * ML_PER_FLOZ;
}

export function formatQuantity(value: number, unit: 'g' | 'ml', foodUnit: FoodUnit = 'metric'): string {
  const d = quantityToDisplay(value, unit, foodUnit);
  return `${nf1.format(d.value)} ${d.unit}`;
}

/** kcal are shown as integers (FR-037). */
export function formatKcal(kcal: number): string {
  return nf0.format(Math.round(kcal));
}

/** Grams shown with one decimal (FR-037). */
export function formatGrams(g: number | null): string {
  return g === null ? '—' : nf1.format(Math.round(g * 10) / 10);
}

export function formatEstimate(text: string): string {
  return `${text} (estimado)`;
}

export function formatSigned(n: number): string {
  const r = Math.round(n);
  return r > 0 ? `+${nf0.format(r)}` : nf0.format(r);
}
