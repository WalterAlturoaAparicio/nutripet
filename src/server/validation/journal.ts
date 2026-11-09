import { z } from 'zod';
import { QUANTITY_MAX } from '@/domain/config';
import { id, localDate, note } from './common';

const occasion = z.enum(['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'extra']);
const unit = z.enum(['g', 'ml']);
const quantity = z
  .number({ error: 'Ingresa una cantidad.' })
  .positive('La cantidad debe ser mayor que 0.')
  .max(QUANTITY_MAX, `La cantidad máxima por registro es ${QUANTITY_MAX}.`);
const label = z.string().trim().min(1).max(40).optional();

/** How much of a saved preparation was eaten (FR-045). */
export const portionSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('whole') }),
  z.object({
    mode: z.literal('servings'),
    servings: z.number({ error: 'Indica cuántas porciones.' }).positive('Las porciones deben ser mayores que 0.').max(100),
  }),
  z.object({ mode: z.literal('amount'), quantity, unit }),
]);

const foodItem = z.object({ foodId: id, quantity, unit });
const recipeItem = z.object({ recipeId: id, portion: portionSchema });
/** One meal item: a food with its quantity, or a portion of a saved preparation. */
export const mealItemSchema = z.union([foodItem, recipeItem]);
const mealItems = z.array(mealItemSchema).min(1, 'Agrega al menos un alimento.').max(30, 'Máximo 30 alimentos por comida.');
const isoDateTime = z.iso.datetime({ offset: true }).optional();

const requireLabelForExtra = <T extends { occasion?: string; label?: string }>(v: T) => v.occasion !== 'extra' || Boolean(v.label);
const labelIssue = { message: 'Ponle un nombre a la comida adicional.', path: ['label'] };

// Preparation state is not an input: it belongs to the chosen food variant (FR-031).
export const addEntrySchema = z
  .object({ occasion, label, foodId: id, quantity, unit, eatenAt: isoDateTime, note, confirm: z.boolean().optional() })
  .refine(requireLabelForExtra, labelIssue);

export const batchEntriesSchema = z
  .object({
    occasion,
    label,
    items: mealItems,
    confirm: z.boolean().optional(),
  })
  .refine(requireLabelForExtra, labelIssue);

/**
 * Saves the whole content of an existing meal at once (FR-035a): items with an entryId keep their
 * snapshot and only change quantity/portion; items without one are added; omitted entries are removed.
 */
export const updateMealSchema = z.object({
  items: z
    .array(
      z.union([
        z.object({ entryId: id, quantity, unit }),
        z.object({ entryId: id, portion: portionSchema }),
        foodItem,
        recipeItem,
      ]),
    )
    .min(1, 'Agrega al menos un alimento.')
    .max(30, 'Máximo 30 alimentos por comida.'),
  confirm: z.boolean().optional(),
});

export const updateEntrySchema = z
  .object({
    quantity: quantity.optional(),
    unit: unit.optional(),
    foodId: id.optional(),
    portion: portionSchema.optional(),
    occasion: occasion.optional(),
    label,
    note,
    eatenAt: isoDateTime,
    confirm: z.boolean().optional(),
  })
  .strict()
  .refine(requireLabelForExtra, labelIssue);

export const duplicateMealSchema = z
  .object({ toDate: localDate, toOccasion: occasion, label })
  .refine((v) => v.toOccasion !== 'extra' || Boolean(v.label), { message: labelIssue.message, path: ['label'] });

export const createTemplateSchema = z.union([
  z.object({ name: z.string().trim().min(1).max(40), fromMealId: id }),
  z.object({ name: z.string().trim().min(1).max(40), items: mealItems }),
]);

export const applyTemplateSchema = z
  .object({ date: localDate, occasion, label })
  .refine(requireLabelForExtra, labelIssue);

export const dayFlagsSchema = z
  .object({ restDay: z.boolean().optional(), markedComplete: z.boolean().optional() })
  .refine((v) => v.restDay !== undefined || v.markedComplete !== undefined, { message: 'Nada que cambiar.' });

export const dateParam = localDate;

export type AddEntryInput = z.infer<typeof addEntrySchema>;
export type UpdateEntryInput = z.infer<typeof updateEntrySchema>;
export type MealItemInput = z.infer<typeof mealItemSchema>;
export type PortionInput = z.infer<typeof portionSchema>;
export type UpdateMealInput = z.infer<typeof updateMealSchema>;
