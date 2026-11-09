'use client';

import { t } from '@/i18n/es';
import { formatKcal, formatWeight, type WeightUnit } from '@/ui/format/units';

export interface HowCalculatedProps {
  energy: {
    formula: 'mifflin_st_jeor' | 'harris_benedict_revised';
    bmrKcal: number;
    activityMultiplier: number;
    baselineTdeeKcal: number;
    adjustmentKcal: number;
    recommendedTargetKcal: number;
    activeTargetKcal: number;
    targetIsOverride: boolean;
  };
  inputs: { weightKg: number; heightCm: number; age: number; sex: 'male' | 'female' | 'unspecified' };
  weightUnit?: WeightUnit;
  effectiveFrom?: string;
  frozen?: boolean;
  exercise?: { name: string; met: number | null; durationMin: number; netKcal: number; method: string }[];
}

const MIFFLIN_CONSTANT = { male: '5', female: '(−161)', unspecified: '(−78)' };

/** Transparent explanation of every estimate (FR-018, Constitution III). */
export function HowCalculated({ energy, inputs, weightUnit = 'kg', effectiveFrom, frozen, exercise }: HowCalculatedProps) {
  const isMifflin = energy.formula === 'mifflin_st_jeor';
  const expr = isMifflin
    ? t('estimates.mifflinExpr', { constant: MIFFLIN_CONSTANT[inputs.sex] })
    : inputs.sex === 'female'
      ? t('estimates.harrisFemaleExpr')
      : t('estimates.harrisMaleExpr');
  const rows: [string, string][] = [
    [t('estimates.bmr'), `${formatKcal(energy.bmrKcal)} kcal`],
    [t('estimates.multiplier'), `× ${energy.activityMultiplier}`],
    [t('estimates.tdee'), `${formatKcal(energy.baselineTdeeKcal)} kcal`],
    [t('estimates.adjustment'), `${energy.adjustmentKcal > 0 ? '+' : ''}${formatKcal(energy.adjustmentKcal)} kcal`],
    [t('estimates.recommended'), `${formatKcal(energy.recommendedTargetKcal)} kcal`],
    [
      t('estimates.active'),
      `${formatKcal(energy.activeTargetKcal)} kcal${energy.targetIsOverride ? ` (${t('estimates.override')})` : ''}`,
    ],
  ];

  return (
    <details className="card mt-4 text-sm">
      <summary className="min-h-touch cursor-pointer py-2 font-semibold">{t('estimates.howCalculated')}</summary>
      <div className="mt-2 space-y-3">
        <p>
          <strong>{isMifflin ? t('estimates.formulaMifflin') : t('estimates.formulaHarris')}</strong>: {expr}
        </p>
        <p className="text-ink-muted">
          {t('estimates.inputs')}: {formatWeight(inputs.weightKg, weightUnit)} · {inputs.heightCm} cm · {inputs.age} años
        </p>
        <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-ink-muted">{k}</dt>
              <dd className="text-right font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        {effectiveFrom && <p className="text-ink-muted">{t('estimates.settingsVersion', { date: effectiveFrom })}</p>}
        {frozen && <p className="text-ink-muted">{t('estimates.frozenPast')}</p>}
        {exercise && (
          <div>
            <h3 className="font-semibold">{t('estimates.exerciseTitle')}</h3>
            <p>{t('estimates.exerciseFormula')}</p>
            {exercise.length > 0 && (
              <ul className="mt-1 list-disc pl-5">
                {exercise.map((e, i) => (
                  <li key={i}>
                    {e.name}: {e.durationMin} min
                    {e.met !== null ? ` · MET ${e.met}` : ''} → {formatKcal(e.netKcal)} kcal
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-1 text-ink-muted">{t('estimates.exerciseNote')}</p>
          </div>
        )}
        <p className="text-ink-muted">{t('estimates.balanceNote')}</p>
        <p className="text-xs text-ink-faint">{t('estimates.disclaimer')}</p>
      </div>
    </details>
  );
}
