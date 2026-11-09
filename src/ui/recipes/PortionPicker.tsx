'use client';

import { useState } from 'react';
import { portionNutrients, type PreparationFacts } from '@/domain/nutrition';
import { t } from '@/i18n/es';
import { formatGrams, formatKcal, formatQuantity, type FoodUnit } from '@/ui/format/units';
import { Segmented } from '@/ui/kit';
import type { PortionInput } from '@/ui/types';

const ERROR_KEYS: Record<string, string> = {
  yield_unknown: 'recipes.portion.needYield',
  not_homogeneous: 'recipes.portion.notHomogeneous',
  portion_exceeds_total: 'recipes.portion.exceeds',
  invalid_quantity: 'journal.builder.empty',
};

/**
 * Chooses how much of a preparation was consumed (FR-045): whole, N servings, or an amount of the
 * actual final yield. Shows the consumed kcal next to the complete preparation's kcal; numbers come
 * from `portionNutrients` in the domain layer.
 */
export function PortionPicker({
  name,
  facts,
  initial,
  foodUnit = 'metric',
  confirmLabel,
  busy,
  onConfirm,
  onByIngredients,
}: {
  name: string;
  facts: PreparationFacts;
  initial?: PortionInput;
  foodUnit?: FoodUnit;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: (p: PortionInput) => void;
  /** Offered when proportional amounts don't apply: log the ingredients actually eaten instead. */
  onByIngredients?: () => void;
}) {
  const amountAllowed = facts.yield !== null && facts.homogeneous;
  const [mode, setMode] = useState<PortionInput['mode']>(initial?.mode ?? 'whole');
  const [servings, setServings] = useState(initial?.mode === 'servings' ? String(initial.servings) : '1');
  const [amount, setAmount] = useState(initial?.mode === 'amount' ? String(initial.quantity) : '');

  const num = (s: string) => (s === '' ? 0 : Number(s.replace(',', '.')));
  const portion: PortionInput =
    mode === 'servings'
      ? { mode, servings: num(servings) }
      : mode === 'amount'
        ? { mode, quantity: num(amount), unit: facts.yield?.unit ?? 'g' }
        : { mode: 'whole' };
  let result: { kcal: number; proteinG: number; carbsG: number; fatG: number } | null = null;
  let error: string | null = null;
  try {
    result = portionNutrients(facts, portion).nutrients;
  } catch (e) {
    error = (e as { code?: string }).code ?? 'invalid';
  }

  const options: { value: PortionInput['mode']; label: string }[] = [{ value: 'whole', label: t('recipes.portion.whole') }];
  if (facts.servings) options.push({ value: 'servings', label: t('recipes.portion.servings') });
  if (amountAllowed) options.push({ value: 'amount', label: t('recipes.portion.amount') });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!error) onConfirm(portion);
      }}
    >
      <p className="text-lg font-semibold">{name}</p>
      <p className="mb-3 text-sm text-ink-muted">
        {t('recipes.total')}: {formatKcal(facts.totals.kcal)} kcal
        {facts.yield && ` · ${formatQuantity(facts.yield.quantity, facts.yield.unit, foodUnit)}`}
        {facts.servings ? ` · ${facts.servings} ${t('recipes.portion.servings').toLowerCase()}` : ''}
      </p>
      <p className="label">{t('recipes.portion.title')}</p>
      <Segmented label={t('recipes.portion.title')} value={mode} options={options} onChange={setMode} />
      {mode === 'servings' && (
        <div className="mt-3 flex items-center gap-2">
          <input
            aria-label={t('recipes.portion.servings')}
            className="input w-28 text-2xl tabular-nums"
            inputMode="decimal"
            value={servings}
            onChange={(e) => setServings(e.target.value.replace(/[^\d.,]/g, ''))}
          />
          <span className="text-sm text-ink-muted">{t('recipes.portion.servingsOf', { total: facts.servings ?? '?' })}</span>
        </div>
      )}
      {mode === 'amount' && facts.yield && (
        <div className="mt-3 flex items-center gap-2">
          <input
            aria-label={t('journal.quantity')}
            className="input w-32 text-2xl tabular-nums"
            inputMode="decimal"
            autoFocus
            value={amount}
            placeholder="0"
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
          />
          <span className="text-sm text-ink-muted">
            {facts.yield.unit} {t('recipes.portion.amountOf', { total: formatQuantity(facts.yield.quantity, facts.yield.unit, foodUnit) })}
          </span>
        </div>
      )}
      {!amountAllowed && (
        <p className="mt-2 text-xs text-ink-faint">{facts.yield ? t('recipes.portion.notHomogeneous') : t('recipes.portion.needYield')}</p>
      )}
      <div aria-label={t('recipes.portion.consumed')} className="mt-3 grid grid-cols-4 gap-2 rounded-xl bg-surface-sunken p-3 text-center text-sm">
        <div>
          <p className="text-lg font-bold tabular-nums">{result ? formatKcal(result.kcal) : '—'}</p>
          <p className="text-xs text-ink-muted">kcal</p>
        </div>
        <div>
          <p className="font-semibold tabular-nums">{result ? formatGrams(result.proteinG) : '—'} g</p>
          <p className="text-xs text-ink-muted">{t('dashboard.protein')}</p>
        </div>
        <div>
          <p className="font-semibold tabular-nums">{result ? formatGrams(result.carbsG) : '—'} g</p>
          <p className="text-xs text-ink-muted">{t('dashboard.carbs')}</p>
        </div>
        <div>
          <p className="font-semibold tabular-nums">{result ? formatGrams(result.fatG) : '—'} g</p>
          <p className="text-xs text-ink-muted">{t('dashboard.fat')}</p>
        </div>
      </div>
      {result && <p className="mt-1 text-xs text-ink-muted">{t('recipes.portion.ofTotal', { kcal: formatKcal(result.kcal), total: formatKcal(facts.totals.kcal) })}</p>}
      {error && error !== 'invalid_quantity' && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {t(ERROR_KEYS[error] ?? 'errors.generic')}
        </p>
      )}
      <button className="btn-primary mt-4 w-full text-lg" disabled={Boolean(error) || busy}>
        {confirmLabel}
      </button>
      {onByIngredients && (
        <button type="button" className="btn-secondary mt-2 w-full" onClick={onByIngredients}>
          {t('recipes.portion.byIngredients')}
        </button>
      )}
    </form>
  );
}
