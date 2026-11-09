import { z } from 'zod';
import { id, note } from './common';

const intensity = z.enum(['light', 'moderate', 'vigorous']);
const method = z.enum(['met', 'manual', 'none']);
const duration = z.number().int('Usa minutos enteros.').min(1, 'Mínimo 1 minuto.').max(600, 'Máximo 600 minutos.');
const manualKcal = z.number().min(0).max(3000, 'Máximo 3000 kcal.');
const met = z.number().min(1).max(25).nullable().optional();

export const createActivitySchema = z
  .object({ activityTypeId: id, durationMin: duration, intensity: intensity.nullable().optional(), estimateMethod: method, manualKcal: manualKcal.optional(), note })
  .refine((v) => (v.estimateMethod === 'manual') === (v.manualKcal !== undefined), {
    message: 'Ingresa las calorías solo si eliges "Tengo mi propia estimación".',
    path: ['manualKcal'],
  });

export const updateActivitySchema = z
  .object({
    activityTypeId: id.optional(),
    durationMin: duration.optional(),
    intensity: intensity.nullable().optional(),
    estimateMethod: method.optional(),
    manualKcal: manualKcal.optional(),
    note,
  })
  .strict();

export const createActivityTypeSchema = z.object({
  nameEs: z.string().trim().min(1, 'Escribe un nombre.').max(40),
  metLight: met,
  metModerate: met,
  metVigorous: met,
});

export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>;
