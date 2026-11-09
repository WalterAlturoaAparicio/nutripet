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
    items: z.array(z.object({ foodId: id, quantity, unit })).min(1).max(30),
    confirm: z.boolean().optional(),
  })
  .refine(requireLabelForExtra, labelIssue);

export const updateEntrySchema = z
  .object({
    quantity: quantity.optional(),
    unit: unit.optional(),
    foodId: id.optional(),
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
  z.object({ name: z.string().trim().min(1).max(40), items: z.array(z.object({ foodId: id, quantity, unit })).min(1).max(30) }),
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
