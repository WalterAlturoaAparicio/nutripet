import { z } from 'zod';
import { ADJUSTMENT_LIMIT_KCAL } from '@/domain/config';
import { localDate, timeZone } from './common';

export const pin = z.string().regex(/^\d{4,6}$/, 'El PIN debe tener entre 4 y 6 dígitos.');

const goalType = z.enum(['gain', 'loss', 'maintenance']);
const activityLevel = z.enum(['sedentary', 'light', 'moderate', 'high', 'very_high']);
const sex = z.enum(['male', 'female', 'unspecified']);
const bmrFormula = z.enum(['mifflin_st_jeor', 'harris_benedict_revised']);
const macro = z.number().min(0).max(1000).nullable();

const energyFields = {
  birthDate: localDate,
  sexForFormula: sex,
  heightCm: z.number().min(100, 'Mínimo 100 cm.').max(250, 'Máximo 250 cm.'),
  goalType,
  activityLevel,
  bmrFormula,
  calorieAdjustmentKcal: z.number().int().min(-ADJUSTMENT_LIMIT_KCAL).max(ADJUSTMENT_LIMIT_KCAL),
  calorieTargetOverrideKcal: z.number().int().min(800, 'Mínimo 800 kcal.').max(6000, 'Máximo 6000 kcal.').nullable(),
  proteinTargetG: macro,
  carbsTargetG: macro,
  fatTargetG: macro,
};

const profileFields = {
  name: z.string().trim().min(1, 'Escribe un nombre.').max(40, 'Máximo 40 caracteres.'),
  targetWeightKg: z.number().min(30, 'Mínimo 30 kg.').max(300, 'Máximo 300 kg.'),
  weightUnit: z.enum(['kg', 'lb']),
  heightUnit: z.enum(['cm', 'ft_in']),
  foodUnit: z.enum(['metric', 'imperial']),
  timeZone,
};

export const ENERGY_FIELDS = Object.keys(energyFields) as (keyof typeof energyFields)[];
export const PROFILE_FIELDS = Object.keys(profileFields) as (keyof typeof profileFields)[];

/** Adjustment sign must match the goal: gain ≥ 0, loss ≤ 0, maintenance = 0. */
export function adjustmentMatchesGoal(goal: z.infer<typeof goalType>, adjustment: number): boolean {
  if (goal === 'gain') return adjustment >= 0;
  if (goal === 'loss') return adjustment <= 0;
  return adjustment === 0;
}

export const createProfileSchema = z
  .object({
    ...profileFields,
    weightUnit: profileFields.weightUnit.optional(),
    heightUnit: profileFields.heightUnit.optional(),
    foodUnit: profileFields.foodUnit.optional(),
    timeZone: profileFields.timeZone.optional(),
    birthDate: energyFields.birthDate,
    sexForFormula: energyFields.sexForFormula,
    heightCm: energyFields.heightCm,
    goalType,
    activityLevel,
    bmrFormula: bmrFormula.optional(),
    calorieAdjustmentKcal: energyFields.calorieAdjustmentKcal.optional(),
    calorieTargetOverrideKcal: energyFields.calorieTargetOverrideKcal.optional(),
    proteinTargetG: macro.optional(),
    carbsTargetG: macro.optional(),
    fatTargetG: macro.optional(),
    weightKg: z.number().min(20, 'Mínimo 20 kg.').max(350, 'Máximo 350 kg.'),
    pin,
    petName: z.string().trim().min(1).max(24).optional(),
    setupToken: z.string().max(256).optional(),
    confirm: z.boolean().optional(),
  })
  .refine((v) => v.calorieAdjustmentKcal === undefined || adjustmentMatchesGoal(v.goalType, v.calorieAdjustmentKcal), {
    path: ['calorieAdjustmentKcal'],
    message: 'El ajuste debe ser positivo para subir, negativo para bajar y 0 para mantener.',
  });

export const updateProfileSchema = z
  .object({
    ...Object.fromEntries(Object.entries(profileFields).map(([k, v]) => [k, v.optional()])),
    ...Object.fromEntries(Object.entries(energyFields).map(([k, v]) => [k, v.optional()])),
    confirm: z.boolean().optional(),
  })
  .strict() as unknown as z.ZodType<UpdateProfileInput>;

export type CreateProfileInput = z.infer<typeof createProfileSchema>;
export type UpdateProfileInput = Partial<{
  name: string;
  targetWeightKg: number;
  weightUnit: 'kg' | 'lb';
  heightUnit: 'cm' | 'ft_in';
  foodUnit: 'metric' | 'imperial';
  timeZone: string;
  birthDate: string;
  sexForFormula: z.infer<typeof sex>;
  heightCm: number;
  goalType: z.infer<typeof goalType>;
  activityLevel: z.infer<typeof activityLevel>;
  bmrFormula: z.infer<typeof bmrFormula>;
  calorieAdjustmentKcal: number;
  calorieTargetOverrideKcal: number | null;
  proteinTargetG: number | null;
  carbsTargetG: number | null;
  fatTargetG: number | null;
  confirm: boolean;
}>;

export const loginSchema = z.object({ profileId: z.string().min(1).max(64), pin });

export const pinResetSchema = z.object({
  recoveryCode: z.string().trim().min(8).max(32),
  newPin: pin,
});

export const enrollDeviceSchema = z
  .object({
    label: z.string().trim().min(1, 'Escribe un nombre para el dispositivo.').max(40),
    setupToken: z.string().max(256).optional(),
    pairingCode: z.string().trim().max(32).optional(),
  })
  .refine((v) => Boolean(v.setupToken) !== Boolean(v.pairingCode), {
    message: 'Usa un código de emparejamiento o el token de configuración.',
    path: ['pairingCode'],
  });
