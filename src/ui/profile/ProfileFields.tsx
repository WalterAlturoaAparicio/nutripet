'use client';

import { useMemo } from 'react';
import { t } from '@/i18n/es';
import { Field, NumberInput, Segmented } from '@/ui/kit';
import { cmToFtIn, displayToKg, ftInToCm, kgToDisplay, type HeightUnit, type WeightUnit } from '@/ui/format/units';

export type GoalType = 'gain' | 'loss' | 'maintenance';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'high' | 'very_high';
export type Sex = 'male' | 'female' | 'unspecified';

export interface ProfileDraft {
  name: string;
  birthDate: string;
  sexForFormula: Sex;
  heightCm: number | '';
  weightKg: number | '';
  targetWeightKg: number | '';
  goalType: GoalType;
  activityLevel: ActivityLevel;
  calorieAdjustmentKcal: number | '';
  calorieTargetOverrideKcal: number | '';
  proteinTargetG: number | '';
  carbsTargetG: number | '';
  fatTargetG: number | '';
  weightUnit: WeightUnit;
  heightUnit: HeightUnit;
  foodUnit: 'metric' | 'imperial';
  timeZone: string;
}

type Set = <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => void;
type Errors = Record<string, string | undefined>;

const round1 = (n: number) => Math.round(n * 10) / 10;

export function WeightInput({
  id,
  kg,
  unit,
  onChange,
}: {
  id: string;
  kg: number | '';
  unit: WeightUnit;
  onChange: (kg: number | '') => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <NumberInput
        id={id}
        value={kg === '' ? '' : round1(kgToDisplay(kg, unit))}
        onChange={(v) => onChange(v === '' ? '' : displayToKg(v, unit))}
        step="0.1"
      />
      <span className="w-8 text-ink-muted">{unit}</span>
    </div>
  );
}

export function HeightInput({ id, cm, unit, onChange }: { id: string; cm: number | ''; unit: HeightUnit; onChange: (cm: number | '') => void }) {
  if (unit === 'cm') {
    return (
      <div className="flex items-center gap-2">
        <NumberInput id={id} value={cm} onChange={onChange} step="1" inputMode="numeric" />
        <span className="w-8 text-ink-muted">cm</span>
      </div>
    );
  }
  const { ft, inch } = cm === '' ? { ft: 0, inch: 0 } : cmToFtIn(cm);
  return (
    <div className="flex items-center gap-2">
      <NumberInput id={id} value={cm === '' ? '' : ft} onChange={(v) => onChange(ftInToCm(Number(v || 0), inch))} step="1" />
      <span className="text-ink-muted">ft</span>
      <NumberInput aria-label="in" value={cm === '' ? '' : inch} onChange={(v) => onChange(ftInToCm(ft, Number(v || 0)))} step="0.5" />
      <span className="text-ink-muted">in</span>
    </div>
  );
}

export function PersonalSection({ draft, set, errors, includeWeight }: { draft: ProfileDraft; set: Set; errors: Errors; includeWeight: boolean }) {
  return (
    <>
      <Field label={t('onboarding.name')} error={errors.name}>
        {(id) => <input id={id} className="input" value={draft.name} maxLength={40} onChange={(e) => set('name', e.target.value)} />}
      </Field>
      <Field label={t('onboarding.birthDate')} error={errors.birthDate}>
        {(id) => <input id={id} type="date" className="input" value={draft.birthDate} onChange={(e) => set('birthDate', e.target.value)} />}
      </Field>
      <Field label={t('onboarding.sex')} help={draft.sexForFormula === 'unspecified' ? t('onboarding.sexUnspecifiedHelp') : undefined}>
        {() => (
          <Segmented
            label={t('onboarding.sex')}
            value={draft.sexForFormula}
            onChange={(v) => set('sexForFormula', v)}
            options={[
              { value: 'female', label: t('onboarding.sexFemale') },
              { value: 'male', label: t('onboarding.sexMale') },
              { value: 'unspecified', label: t('onboarding.sexUnspecified') },
            ]}
          />
        )}
      </Field>
      <div className="mb-2 flex flex-wrap gap-2">
        <Segmented
          label={t('profile.heightUnit')}
          value={draft.heightUnit}
          onChange={(v) => set('heightUnit', v)}
          options={[
            { value: 'cm', label: 'cm' },
            { value: 'ft_in', label: 'ft/in' },
          ]}
        />
        <Segmented
          label={t('profile.weightUnit')}
          value={draft.weightUnit}
          onChange={(v) => set('weightUnit', v)}
          options={[
            { value: 'kg', label: 'kg' },
            { value: 'lb', label: 'lb' },
          ]}
        />
      </div>
      <Field label={t('onboarding.height')} error={errors.heightCm}>
        {(id) => <HeightInput id={id} cm={draft.heightCm} unit={draft.heightUnit} onChange={(v) => set('heightCm', v)} />}
      </Field>
      {includeWeight && (
        <Field label={t('onboarding.weight')} error={errors.weightKg}>
          {(id) => <WeightInput id={id} kg={draft.weightKg} unit={draft.weightUnit} onChange={(v) => set('weightKg', v)} />}
        </Field>
      )}
      <Field label={t('onboarding.targetWeight')} error={errors.targetWeightKg}>
        {(id) => <WeightInput id={id} kg={draft.targetWeightKg} unit={draft.weightUnit} onChange={(v) => set('targetWeightKg', v)} />}
      </Field>
    </>
  );
}

const LEVELS: ActivityLevel[] = ['sedentary', 'light', 'moderate', 'high', 'very_high'];
export const DEFAULT_ADJUSTMENT: Record<GoalType, number> = { gain: 300, loss: -400, maintenance: 0 };

export function GoalSection({ draft, set, errors }: { draft: ProfileDraft; set: Set; errors: Errors }) {
  return (
    <>
      <Field label={t('onboarding.goal')}>
        {() => (
          <Segmented
            label={t('onboarding.goal')}
            value={draft.goalType}
            onChange={(v) => {
              set('goalType', v);
              set('calorieAdjustmentKcal', DEFAULT_ADJUSTMENT[v]);
            }}
            options={[
              { value: 'gain', label: t('onboarding.goalGain') },
              { value: 'loss', label: t('onboarding.goalLoss') },
              { value: 'maintenance', label: t('onboarding.goalMaintenance') },
            ]}
          />
        )}
      </Field>
      <fieldset className="mb-4">
        <legend className="label">{t('onboarding.activityLevel')}</legend>
        <p className="mb-2 text-xs text-ink-faint">{t('onboarding.activityExcludes')}</p>
        <div className="space-y-2">
          {LEVELS.map((level) => (
            <label
              key={level}
              className={`flex min-h-touch cursor-pointer items-start gap-3 rounded-xl p-3 ring-1 ${draft.activityLevel === level ? 'bg-target-soft ring-target' : 'ring-black/10'}`}
            >
              <input
                type="radio"
                name="activityLevel"
                className="mt-1"
                checked={draft.activityLevel === level}
                onChange={() => set('activityLevel', level)}
              />
              <span>
                <span className="block font-semibold">{t(`activityLevels.${level}`)}</span>
                <span className="block text-sm text-ink-muted">{t(`activityLevels.${level}Help`)}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {draft.goalType !== 'maintenance' && (
        <Field label={t('onboarding.adjustment')} help={t('onboarding.adjustmentHelp')} error={errors.calorieAdjustmentKcal}>
          {(id) => (
            <NumberInput
              id={id}
              value={draft.calorieAdjustmentKcal}
              step="50"
              inputMode="numeric"
              onChange={(v) => set('calorieAdjustmentKcal', v)}
            />
          )}
        </Field>
      )}
    </>
  );
}

export function PreferencesSection({ draft, set }: { draft: ProfileDraft; set: Set }) {
  const zones = useMemo(() => {
    try {
      return (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf('timeZone');
    } catch {
      return ['America/Bogota'];
    }
  }, []);
  return (
    <>
      <Field label={t('profile.foodUnit')}>
        {() => (
          <Segmented
            label={t('profile.foodUnit')}
            value={draft.foodUnit}
            onChange={(v) => set('foodUnit', v)}
            options={[
              { value: 'metric', label: t('profile.foodMetric') },
              { value: 'imperial', label: t('profile.foodImperial') },
            ]}
          />
        )}
      </Field>
      <Field label={t('profile.timeZone')} help={t('profile.timeZoneHelp')}>
        {(id) => (
          <select id={id} className="input" value={draft.timeZone} onChange={(e) => set('timeZone', e.target.value)}>
            {(zones.includes(draft.timeZone) ? zones : [draft.timeZone, ...zones]).map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        )}
      </Field>
    </>
  );
}

export function emptyDraft(): ProfileDraft {
  return {
    name: '',
    birthDate: '',
    sexForFormula: 'female',
    heightCm: '',
    weightKg: '',
    targetWeightKg: '',
    goalType: 'maintenance',
    activityLevel: 'light',
    calorieAdjustmentKcal: 0,
    calorieTargetOverrideKcal: '',
    proteinTargetG: '',
    carbsTargetG: '',
    fatTargetG: '',
    weightUnit: 'kg',
    heightUnit: 'cm',
    foodUnit: 'metric',
    timeZone: 'America/Bogota',
  };
}

export const orNull = (v: number | '') => (v === '' ? null : v);
