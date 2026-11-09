import { z } from 'zod';
import { FOOD_CATEGORIES } from '../db/schema/foods';

const g = (max: number) => z.number().min(0, 'No puede ser negativo.').max(max);
const optional = (max: number) => g(max).nullable().optional();

/** Nutrients per 100 g/ml, same bounds as food_version (data-model.md). Unknown optional values stay null. */
export const nutrientFields = {
  basis: z.enum(['g', 'ml']),
  kcal: g(900),
  proteinG: g(100),
  carbsG: g(100),
  fatG: g(100),
  fiberG: optional(100),
  sugarG: optional(100),
  sodiumMg: optional(40000),
  densityGPerMl: z.number().min(0.3).max(2).nullable().optional(),
};

type NutrientShape = { basis: 'g' | 'ml'; proteinG: number; carbsG: number; fatG: number; sugarG?: number | null };

export const nutrientChecks = <T extends z.ZodType<NutrientShape>>(schema: T) =>
  schema
    .refine((v) => v.basis !== 'g' || v.proteinG + v.carbsG + v.fatG <= 100, {
      message: 'Proteína + carbohidratos + grasa no pueden superar 100 g por 100 g.',
      path: ['fatG'],
    })
    .refine((v) => v.sugarG == null || v.sugarG <= v.carbsG, { message: 'Los azúcares no pueden superar los carbohidratos.', path: ['sugarG'] });

export const createCustomFoodSchema = nutrientChecks(
  z.object({
    nameEs: z.string().trim().min(1, 'Escribe un nombre.').max(80),
    nameEn: z.string().trim().max(80).nullable().optional(),
    aliases: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
    category: z.enum(FOOD_CATEGORIES),
    preparationState: z.enum(['raw', 'cooked', 'prepared', 'packaged']),
    brand: z.string().trim().max(60).nullable().optional(),
    sourceNote: z.string().trim().min(1, 'Indica de dónde salen los valores.').max(200),
    ...nutrientFields,
  }),
);

export const updateCustomFoodSchema = z
  .object({
    nameEs: z.string().trim().min(1).max(80).optional(),
    nameEn: z.string().trim().max(80).nullable().optional(),
    aliases: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
    category: z.enum(FOOD_CATEGORIES).optional(),
    preparationState: z.enum(['raw', 'cooked', 'prepared', 'packaged']).optional(),
    brand: z.string().trim().max(60).nullable().optional(),
    sourceNote: z.string().trim().min(1).max(200).optional(),
    nutrients: nutrientChecks(z.object(nutrientFields)).optional(),
  })
  .strict();

export const overrideSchema = nutrientChecks(z.object({ ...nutrientFields, note: z.string().trim().max(200).optional() }));

export type CustomFoodInput = z.infer<typeof createCustomFoodSchema>;
export type NutrientInput = z.infer<typeof overrideSchema>;
