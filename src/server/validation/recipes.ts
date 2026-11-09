import { z } from 'zod';
import { QUANTITY_MAX } from '@/domain/config';
import { id } from './common';

const unit = z.enum(['g', 'ml']);
const quantity = z
  .number({ error: 'Ingresa una cantidad.' })
  .positive('La cantidad debe ser mayor que 0.')
  .max(QUANTITY_MAX, `La cantidad máxima por ingrediente es ${QUANTITY_MAX}.`);

/** Recipe (preparation) definition (FR-038, FR-039). Every save creates a new immutable version. */
export const recipeSchema = z
  .object({
    name: z.string().trim().min(1, 'Ponle un nombre a la preparación.').max(60),
    notes: z.string().trim().max(500, 'Máximo 500 caracteres.').nullable().optional(),
    servings: z.number().positive('Las porciones deben ser mayores que 0.').max(100).nullable().optional(),
    yieldQuantity: z.number().positive('El rendimiento debe ser mayor que 0.').max(50_000).nullable().optional(),
    yieldUnit: unit.nullable().optional(),
    homogeneous: z.boolean().optional(),
    ingredients: z
      .array(z.object({ foodId: id, quantity, unit }))
      .min(1, 'Agrega al menos un ingrediente.')
      .max(30, 'Máximo 30 ingredientes.'),
  })
  .refine((v) => (v.yieldQuantity == null) === (v.yieldUnit == null), {
    message: 'Indica la cantidad final y su unidad (g o ml).',
    path: ['yieldUnit'],
  });

export type RecipeInput = z.infer<typeof recipeSchema>;

export const recipeVersionQuery = z.object({ versionId: id.optional() });
