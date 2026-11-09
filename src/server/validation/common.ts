import { z } from 'zod';
import { isLocalDate, isValidTimeZone } from '@/domain/dates';

export const localDate = z.string().refine(isLocalDate, 'Fecha inválida (AAAA-MM-DD).');
export const timeZone = z.string().refine(isValidTimeZone, 'Zona horaria inválida.');
export const id = z.string().min(1).max(64);
export const note = z.string().trim().max(280, 'Máximo 280 caracteres.').optional().nullable();
