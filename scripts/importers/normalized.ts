/** Adapter output shared by every food source (contracts/food-import-format.md). */
import type { FoodCategory } from '../../src/server/db/schema/foods';

export interface NormalizedFood {
  sourceFoodId: string;
  nameEs: string;
  nameEn?: string | null;
  aliases?: { alias: string; lang: 'es' | 'en' }[];
  category: FoodCategory;
  preparationState: 'raw' | 'cooked' | 'prepared' | 'packaged';
  brand?: string | null;
  basis: 'g' | 'ml';
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** null when the source lacks the value — never 0. */
  fiberG: number | null;
  sugarG: number | null;
  sodiumMg: number | null;
  densityGPerMl?: number | null;
  sourceVersion: string;
}

export interface AdapterResult {
  /** Version label recorded on the import run (may combine several dataset releases). */
  sourceVersion: string;
  /** Files whose bytes define this import (checksummed for reproducibility). */
  inputFiles: string[];
  foods: NormalizedFood[];
  /** Records the adapter could not normalize (e.g. missing nutrients), reported, not imported. */
  skipped: { sourceFoodId: string; name: string; reason: string }[];
}
