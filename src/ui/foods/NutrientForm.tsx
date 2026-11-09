'use client';

import { t } from '@/i18n/es';
import { Field, NumberInput, Segmented } from '@/ui/kit';

export interface NutrientDraft {
  basis: 'g' | 'ml';
  kcal: number | '';
  proteinG: number | '';
  carbsG: number | '';
  fatG: number | '';
  fiberG: number | '';
  sugarG: number | '';
  sodiumMg: number | '';
  densityGPerMl: number | '';
}

export const emptyNutrients = (): NutrientDraft => ({
  basis: 'g',
  kcal: '',
  proteinG: '',
  carbsG: '',
  fatG: '',
  fiberG: '',
  sugarG: '',
  sodiumMg: '',
  densityGPerMl: '',
});

/** Optional nutrients left empty are sent as null = unknown, never 0 (FR-021). */
export function nutrientPayload(n: NutrientDraft) {
  const opt = (v: number | '') => (v === '' ? null : v);
  return {
    basis: n.basis,
    kcal: Number(n.kcal || 0),
    proteinG: Number(n.proteinG || 0),
    carbsG: Number(n.carbsG || 0),
    fatG: Number(n.fatG || 0),
    fiberG: opt(n.fiberG),
    sugarG: opt(n.sugarG),
    sodiumMg: opt(n.sodiumMg),
    densityGPerMl: opt(n.densityGPerMl),
  };
}

export function NutrientForm({
  value,
  onChange,
  errors = {},
}: {
  value: NutrientDraft;
  onChange: (v: NutrientDraft) => void;
  errors?: Record<string, string | undefined>;
}) {
  const set = (k: keyof NutrientDraft) => (v: number | '') => onChange({ ...value, [k]: v });
  const core: [keyof NutrientDraft, string, string][] = [
    ['kcal', t('foods.nutrients.kcal'), 'kcal'],
    ['proteinG', t('foods.nutrients.protein'), 'g'],
    ['carbsG', t('foods.nutrients.carbs'), 'g'],
    ['fatG', t('foods.nutrients.fat'), 'g'],
  ];
  const optional: [keyof NutrientDraft, string, string][] = [
    ['fiberG', t('foods.nutrients.fiber'), 'g'],
    ['sugarG', t('foods.nutrients.sugar'), 'g'],
    ['sodiumMg', t('foods.nutrients.sodium'), 'mg'],
  ];
  return (
    <div>
      <Field label={t('foods.basis')}>
        {() => (
          <Segmented
            label={t('foods.basis')}
            value={value.basis}
            onChange={(b) => onChange({ ...value, basis: b })}
            options={[
              { value: 'g', label: '100 g' },
              { value: 'ml', label: '100 ml' },
            ]}
          />
        )}
      </Field>
      <div className="grid grid-cols-2 gap-x-3">
        {core.map(([k, label, unit]) => (
          <Field key={k} label={`${label} (${unit})`} error={errors[k]}>
            {(id) => <NumberInput id={id} value={value[k] as number | ''} onChange={set(k)} step="0.1" min={0} required />}
          </Field>
        ))}
      </div>
      <p className="mb-2 text-xs text-ink-faint">{t('foods.optionalUnknown')}</p>
      <div className="grid grid-cols-3 gap-x-3">
        {optional.map(([k, label, unit]) => (
          <Field key={k} label={`${label} (${unit})`} error={errors[k]}>
            {(id) => <NumberInput id={id} value={value[k] as number | ''} onChange={set(k)} step="0.1" min={0} />}
          </Field>
        ))}
      </div>
      {value.basis === 'ml' && (
        <Field label="Densidad (g/ml, opcional)" error={errors.densityGPerMl}>
          {(id) => <NumberInput id={id} value={value.densityGPerMl} onChange={set('densityGPerMl')} step="0.01" min={0.3} max={2} />}
        </Field>
      )}
    </div>
  );
}
