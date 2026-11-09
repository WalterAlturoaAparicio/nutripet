import { index, integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { profile, weightRecord } from './profiles';

/** Effective-dated, immutable energy-relevant settings (FR-019). Rows are never updated. */
export const profileSettingsVersion = sqliteTable(
  'profile_settings_version',
  {
    id: text('id').primaryKey(),
    profileId: text('profile_id')
      .notNull()
      .references(() => profile.id, { onDelete: 'cascade' }),
    effectiveFrom: text('effective_from').notNull(),
    createdAt: text('created_at').notNull(),
    birthDate: text('birth_date').notNull(),
    sexForFormula: text('sex_for_formula', { enum: ['male', 'female', 'unspecified'] }).notNull(),
    heightCm: real('height_cm').notNull(),
    goalType: text('goal_type', { enum: ['gain', 'loss', 'maintenance'] }).notNull(),
    activityLevel: text('activity_level', { enum: ['sedentary', 'light', 'moderate', 'high', 'very_high'] }).notNull(),
    activityMultiplier: real('activity_multiplier').notNull(),
    bmrFormula: text('bmr_formula', { enum: ['mifflin_st_jeor', 'harris_benedict_revised'] }).notNull(),
    calorieAdjustmentKcal: integer('calorie_adjustment_kcal').notNull(),
    calorieTargetOverrideKcal: integer('calorie_target_override_kcal'),
    proteinTargetG: real('protein_target_g'),
    carbsTargetG: real('carbs_target_g'),
    fatTargetG: real('fat_target_g'),
    calcVersion: integer('calc_version').notNull(),
  },
  (t) => [index('settings_profile_effective_idx').on(t.profileId, t.effectiveFrom)],
);

/** Frozen per-day energy inputs and results. Past rows are never modified. */
export const dayEnergySnapshot = sqliteTable(
  'day_energy_snapshot',
  {
    profileId: text('profile_id')
      .notNull()
      .references(() => profile.id, { onDelete: 'cascade' }),
    localDate: text('local_date').notNull(),
    settingsVersionId: text('settings_version_id')
      .notNull()
      .references(() => profileSettingsVersion.id),
    weightKg: real('weight_kg').notNull(),
    // Not a hard FK: weight records may be deleted later without touching frozen snapshots.
    weightRecordId: text('weight_record_id').notNull(),
    age: integer('age').notNull(),
    bmrKcal: real('bmr_kcal').notNull(),
    activityMultiplier: real('activity_multiplier').notNull(),
    baselineTdeeKcal: real('baseline_tdee_kcal').notNull(),
    adjustmentKcal: integer('adjustment_kcal').notNull(),
    recommendedTargetKcal: real('recommended_target_kcal').notNull(),
    activeTargetKcal: real('active_target_kcal').notNull(),
    targetIsOverride: integer('target_is_override', { mode: 'boolean' }).notNull(),
    proteinTargetG: real('protein_target_g'),
    carbsTargetG: real('carbs_target_g'),
    fatTargetG: real('fat_target_g'),
    bmrFormula: text('bmr_formula', { enum: ['mifflin_st_jeor', 'harris_benedict_revised'] }).notNull(),
    calcVersion: integer('calc_version').notNull(),
    createdAt: text('created_at').notNull(),
    refreshedAt: text('refreshed_at'),
  },
  (t) => [primaryKey({ columns: [t.profileId, t.localDate] })],
);

export { weightRecord };
