import { z } from 'zod';
import { localDate, note } from './common';

const weightKg = z.number().min(20, 'Mínimo 20 kg.').max(350, 'Máximo 350 kg.');

export const createWeightSchema = z.object({ date: localDate, weightKg, note });
export const updateWeightSchema = z.object({ date: localDate.optional(), weightKg: weightKg.optional(), note }).strict();
export const weightQuerySchema = z.object({ from: localDate.optional(), to: localDate.optional() });
