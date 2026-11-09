import { and, eq } from 'drizzle-orm';
import { food, foodAlias, foodVersion } from '../schema';
import { newId } from '../ids';
import { nowIso } from '../../clock';
import { registerSeeder } from './index';

/**
 * Built-in reference foods (FR-047). Only records whose values are physically established belong
 * here: plain water contains no energy, protein, carbohydrate, fat, fiber or sugar. Sodium varies
 * with the water supply, so it stays unknown. Other liquids (milk, juices…) are NEVER assumed to be
 * zero; they come from the catalog sources with their own values.
 */
export const REFERENCE_FOODS = [
  {
    sourceFoodId: 'water',
    nameEs: 'Agua',
    nameEn: 'Water',
    aliases: [
      { alias: 'agua potable', lang: 'es' },
      { alias: 'agua de la llave', lang: 'es' },
      { alias: 'water', lang: 'en' },
    ],
    category: 'bebidas',
    preparationState: 'raw',
    basis: 'ml',
    densityGPerMl: 1,
    kcal: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    fiberG: 0,
    sugarG: 0,
    sodiumMg: null,
  },
] as const;

const SOURCE_VERSION = 'reference-1';

registerSeeder({
  name: 'reference-foods',
  run: (d) => {
    for (const r of REFERENCE_FOODS) {
      // Identity is (data_source, source_food_id): re-running never duplicates the record.
      const existing = d.select({ id: food.id }).from(food).where(and(eq(food.dataSourceId, 'reference'), eq(food.sourceFoodId, r.sourceFoodId))).get();
      if (existing) continue;
      const ts = nowIso();
      const id = newId();
      const versionId = newId();
      d.insert(food)
        .values({
          id,
          dataSourceId: 'reference',
          sourceFoodId: r.sourceFoodId,
          ownerProfileId: null,
          nameEs: r.nameEs,
          nameEn: r.nameEn,
          category: r.category,
          preparationState: r.preparationState,
          productForm: 'as_sold',
          brand: null,
          sourceNote: 'Valor de referencia: el agua no aporta energía ni macronutrientes.',
          createdAt: ts,
          updatedAt: ts,
        })
        .run();
      for (const a of r.aliases) d.insert(foodAlias).values({ foodId: id, alias: a.alias, lang: a.lang }).onConflictDoNothing().run();
      d.insert(foodVersion)
        .values({
          id: versionId,
          foodId: id,
          versionNo: 1,
          basis: r.basis,
          kcal: r.kcal,
          proteinG: r.proteinG,
          carbsG: r.carbsG,
          fatG: r.fatG,
          fiberG: r.fiberG,
          sugarG: r.sugarG,
          sodiumMg: r.sodiumMg,
          densityGPerMl: r.densityGPerMl,
          dataSourceId: 'reference',
          sourceVersion: SOURCE_VERSION,
          importRunId: null,
          createdAt: ts,
        })
        .run();
      d.update(food).set({ currentVersionId: versionId }).where(eq(food.id, id)).run();
    }
  },
});
