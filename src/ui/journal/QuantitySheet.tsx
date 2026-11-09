'use client';

import { useEffect, useMemo, useState } from 'react';
import { scaleNutrients } from '@/domain/nutrition';
import { t } from '@/i18n/es';
import { api } from '@/ui/api';
import { displayToQuantity, formatGrams, formatKcal, quantityToDisplay, type FoodUnit } from '@/ui/format/units';
import { SourceBadge, StateChip } from '@/ui/foods/FoodSearch';
import type { FoodSummary } from '@/ui/types';

/**
 * Weighed-quantity entry with a live nutrient preview. The preparation state belongs to the chosen
 * variant (U4); sibling variants (raw ↔ cooked) are one tap away.
 */
export function QuantitySheet({
  food: initialFood,
  foodUnit = 'metric',
  initialQuantity,
  initialUnit,
  confirmLabel,
  busy,
  onConfirm,
}: {
  food: FoodSummary;
  foodUnit?: FoodUnit;
  initialQuantity?: number;
  initialUnit?: 'g' | 'ml';
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: (v: { foodId: string; quantity: number; unit: 'g' | 'ml'; food: FoodSummary }) => void;
}) {
  const [food, setFood] = useState(initialFood);
  const [unit, setUnit] = useState<'g' | 'ml'>(initialUnit ?? initialFood.basis);
  const [display, setDisplay] = useState<string>(() =>
    initialQuantity ? String(Math.round(quantityToDisplay(initialQuantity, initialUnit ?? initialFood.basis, foodUnit).value * 10) / 10) : '',
  );
  const [variants, setVariants] = useState<FoodSummary[]>([]);

  useEffect(() => {
    api<FoodSummary[]>('GET', `/api/v1/foods/${initialFood.id}/variants`).then(setVariants).catch(() => setVariants([]));
  }, [initialFood.id]);

  const quantity = display === '' ? 0 : displayToQuantity(Number(display.replace(',', '.')), unit, foodUnit);
  const preview = useMemo(
    () =>
      scaleNutrients(
        { kcal: food.kcalPer100, proteinG: food.proteinPer100, carbsG: food.carbsPer100, fatG: food.fatPer100, fiberG: null, sugarG: null, sodiumMg: null },
        quantity || 0,
        unit,
        food.basis,
        food.densityGPerMl,
      ),
    [food, quantity, unit],
  );
  const unitLabel = quantityToDisplay(0, unit, foodUnit).unit;
  const valid = quantity > 0 && quantity <= 5000;
  const allVariants = [initialFood, ...variants.filter((v) => v.id !== initialFood.id)];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onConfirm({ foodId: food.id, quantity, unit, food });
      }}
    >
      <div className="mb-3">
        <p className="text-lg font-semibold">{food.nameEs}</p>
        <p className="mt-1 flex flex-wrap items-center gap-1">
          <StateChip state={food.preparationState} />
          <SourceBadge source={food.source} />
          {food.brand && <span className="text-xs text-ink-muted">{food.brand}</span>}
        </p>
      </div>
      {allVariants.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-2" role="radiogroup" aria-label={t('foods.preparation')}>
          {allVariants.map((v) => (
            <button
              key={v.id}
              type="button"
              role="radio"
              aria-checked={v.id === food.id}
              className={`rounded-full px-3 py-1 text-xs ${v.id === food.id ? 'bg-ink text-white' : 'bg-surface-sunken'}`}
              onClick={() => {
                setFood(v);
                setUnit(v.basis);
              }}
            >
              {v.nameEs.split(',').slice(1).join(',').trim() || t(`foods.states.${v.preparationState}`)}
            </button>
          ))}
        </div>
      )}
      <label htmlFor="qty" className="label">
        {t('journal.quantity')}
      </label>
      <div className="flex items-center gap-2">
        <input
          id="qty"
          className="input text-2xl tabular-nums"
          inputMode="decimal"
          autoFocus
          value={display}
          placeholder="0"
          onChange={(e) => setDisplay(e.target.value.replace(/[^\d.,]/g, ''))}
        />
        <div className="flex rounded-xl bg-surface-sunken p-1" role="radiogroup" aria-label="Unidad">
          {(['g', 'ml'] as const).map((u) => (
            <button
              key={u}
              type="button"
              role="radio"
              aria-checked={unit === u}
              className={`min-h-touch rounded-lg px-3 text-sm font-semibold ${unit === u ? 'bg-white shadow' : ''}`}
              onClick={() => setUnit(u)}
            >
              {quantityToDisplay(0, u, foodUnit).unit}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 rounded-xl bg-surface-sunken p-3 text-center text-sm">
        <div>
          <p className="text-lg font-bold tabular-nums">{formatKcal(preview.nutrients.kcal)}</p>
          <p className="text-xs text-ink-muted">kcal</p>
        </div>
        <div>
          <p className="font-semibold tabular-nums">{formatGrams(preview.nutrients.proteinG)} g</p>
          <p className="text-xs text-ink-muted">{t('dashboard.protein')}</p>
        </div>
        <div>
          <p className="font-semibold tabular-nums">{formatGrams(preview.nutrients.carbsG)} g</p>
          <p className="text-xs text-ink-muted">{t('dashboard.carbs')}</p>
        </div>
        <div>
          <p className="font-semibold tabular-nums">{formatGrams(preview.nutrients.fatG)} g</p>
          <p className="text-xs text-ink-muted">{t('dashboard.fat')}</p>
        </div>
      </div>
      {preview.approximate && (
        <p className="mt-2 text-xs text-ink-muted">
          <strong>{t('journal.approximate')}:</strong> {t('journal.approximateHelp')}
        </p>
      )}
      <button className="btn-primary mt-4 w-full text-lg" disabled={!valid || busy}>
        {confirmLabel ?? t('journal.add')} {valid ? `· ${formatGrams(Number(display.replace(',', '.')))} ${unitLabel}` : ''}
      </button>
    </form>
  );
}
