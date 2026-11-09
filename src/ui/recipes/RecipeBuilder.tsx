'use client';

import { useEffect, useState } from 'react';
import { computePreparation, type PreparationResult } from '@/domain/nutrition';
import { t } from '@/i18n/es';
import { api, ClientApiError } from '@/ui/api';
import { formatGrams, formatKcal, formatQuantity, type FoodUnit } from '@/ui/format/units';
import { ErrorNote, Field, NumberInput, Segmented } from '@/ui/kit';
import { FoodSearch, StateChip } from '@/ui/foods/FoodSearch';
import { QuantitySheet } from '@/ui/journal/QuantitySheet';
import { foodRow, newKey, rowNutrients, summaryFromRow, type DraftItem } from '@/ui/journal/draft';
import type { FoodSummary, RecipeView } from '@/ui/types';

type Ingredient = Extract<DraftItem, { kind: 'food' }>;

function ingredientsFrom(r: RecipeView): Ingredient[] {
  return r.ingredients.map((i) => ({
    key: newKey(),
    kind: 'food',
    foodId: i.foodId,
    name: i.name,
    preparationState: i.preparationState,
    productForm: i.productForm,
    source: i.source,
    quantity: i.quantity,
    unit: i.unit,
    ref: { ...i.per100 },
  }));
}

function NutrientRow({ label, n, strong }: { label: string; n: { kcal: number; proteinG: number; carbsG: number; fatG: number }; strong?: boolean }) {
  return (
    <div className={`grid grid-cols-[1fr_auto] items-baseline gap-2 py-1 ${strong ? 'font-semibold' : 'text-sm'}`}>
      <span>{label}</span>
      <span className="tabular-nums">
        {formatKcal(n.kcal)} kcal · P {formatGrams(n.proteinG)} · C {formatGrams(n.carbsG)} · G {formatGrams(n.fatG)}
      </span>
    </div>
  );
}

/**
 * Builds a preparation from ingredients (FR-038, FR-039). Totals = sum of each ingredient's own
 * contribution (computed live by `computePreparation`); per-100 values need the real final yield,
 * which the user enters — it is never derived from the ingredient sum.
 */
export function RecipeBuilder({
  initial,
  asVariation,
  foodUnit,
  saveLabel,
  seedFood,
  onSaved,
  onDeleted,
}: {
  initial?: RecipeView;
  /** Starts a new preparation with this food (e.g. a powder the user tried to log directly). */
  seedFood?: FoodSummary;
  asVariation?: boolean;
  foodUnit?: FoodUnit;
  saveLabel?: string;
  onSaved: (r: RecipeView) => void;
  onDeleted?: () => void;
}) {
  const [name, setName] = useState(initial ? (asVariation ? t('recipes.variationName', { name: initial.name }) : initial.name) : '');
  const [items, setItems] = useState<Ingredient[]>(initial ? ingredientsFrom(initial) : []);
  const [servings, setServings] = useState<number | ''>(initial?.servings ?? '');
  const [yieldQty, setYieldQty] = useState<number | ''>(initial?.yield?.quantity ?? '');
  const [yieldUnit, setYieldUnit] = useState<'g' | 'ml'>(initial?.yield?.unit ?? 'ml');
  const [homogeneous, setHomogeneous] = useState(initial?.homogeneous ?? true);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [mode, setMode] = useState<{ kind: 'form' } | { kind: 'search' } | { kind: 'qty'; food: FoodSummary; row?: Ingredient }>(
    seedFood ? { kind: 'qty', food: seedFood } : { kind: 'form' },
  );
  const [water, setWater] = useState<FoodSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ items: FoodSummary[] }>('GET', '/api/v1/foods?q=agua&limit=10')
      .then((r) => setWater(r.items.find((f) => f.source === 'reference') ?? null))
      .catch(() => setWater(null));
  }, []);

  let result: PreparationResult | null = null;
  if (items.length) {
    try {
      result = computePreparation({
        ingredients: items.map((i) => ({
          quantity: i.quantity,
          unit: i.unit,
          basis: i.ref.basis,
          densityGPerMl: i.ref.densityGPerMl,
          per100: { kcal: i.ref.kcal, proteinG: i.ref.proteinG, carbsG: i.ref.carbsG, fatG: i.ref.fatG, fiberG: null, sugarG: null, sodiumMg: null },
        })),
        servings: servings === '' || servings <= 0 ? null : servings,
        yield: yieldQty === '' || yieldQty <= 0 ? null : { quantity: yieldQty, unit: yieldUnit },
      });
    } catch {
      result = null;
    }
  }

  function upsert(food: FoodSummary, quantity: number, unit: 'g' | 'ml', row?: Ingredient) {
    const next = foodRow(food, quantity, unit) as Ingredient;
    setItems((xs) => (row ? xs.map((x) => (x.key === row.key ? { ...next, key: row.key } : x)) : [...xs, next]));
    setMode({ kind: 'form' });
  }

  async function save() {
    setBusy(true);
    setError(null);
    setFields({});
    const body = {
      name: name.trim(),
      notes: notes.trim() || null,
      servings: servings === '' ? null : servings,
      yieldQuantity: yieldQty === '' ? null : yieldQty,
      yieldUnit: yieldQty === '' ? null : yieldUnit,
      homogeneous,
      ingredients: items.map((i) => ({ foodId: i.foodId, quantity: i.quantity, unit: i.unit })),
    };
    try {
      const editing = initial && !asVariation;
      const r = await api<RecipeView>(editing ? 'PUT' : 'POST', editing ? `/api/v1/recipes/${initial.id}` : '/api/v1/recipes', body);
      onSaved(r);
    } catch (e) {
      if (e instanceof ClientApiError) {
        setFields(e.body.fields ?? {});
        setError(Object.values(e.body.fields ?? {})[0] ?? e.body.message);
      } else setError(t('errors.generic'));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!initial) return;
    await api('DELETE', `/api/v1/recipes/${initial.id}`);
    onDeleted?.();
  }

  if (mode.kind === 'search') {
    return (
      <div>
        <button type="button" className="mb-2 text-sm underline" onClick={() => setMode({ kind: 'form' })}>
          ← {t('common.back')}
        </button>
        <FoodSearch onSelect={(food) => setMode({ kind: 'qty', food })} />
      </div>
    );
  }
  if (mode.kind === 'qty') {
    return (
      <div>
        <button type="button" className="mb-2 text-sm underline" onClick={() => setMode({ kind: 'form' })}>
          ← {t('common.back')}
        </button>
        <QuantitySheet
          food={mode.food}
          foodUnit={foodUnit}
          initialQuantity={mode.row?.quantity}
          initialUnit={mode.row?.unit}
          confirmLabel={mode.row ? t('journal.builder.update') : t('journal.builder.addToMeal')}
          inPreparation
          onConfirm={(v) => upsert(v.food, v.quantity, v.unit, mode.row)}
        />
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <Field label={t('recipes.name')} error={fields.name}>
        {(id) => <input id={id} className="input" value={name} maxLength={60} placeholder={t('recipes.namePlaceholder')} onChange={(e) => setName(e.target.value)} required />}
      </Field>

      <p className="label">{t('recipes.ingredients')}</p>
      {items.length === 0 && <p className="mb-2 text-sm text-ink-faint">{t('recipes.noIngredients')}</p>}
      <ul className="mb-2 divide-y divide-black/5" aria-label={t('recipes.ingredients')}>
        {items.map((i, idx) => {
          const n = result?.ingredients[idx]?.nutrients ?? rowNutrients(i).nutrients;
          return (
            <li key={i.key} className="flex items-center justify-between gap-2 py-2">
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setMode({ kind: 'qty', food: summaryFromRow(i), row: i })}>
                <span className="block truncate">{i.name}</span>
                <span className="flex flex-wrap items-center gap-1 text-xs text-ink-muted">
                  <StateChip state={i.preparationState} /> {formatQuantity(i.quantity, i.unit, foodUnit)}
                  {i.productForm !== 'as_sold' && ` · ${t(`foods.productForms.${i.productForm}`)}`}
                </span>
              </button>
              <span className="shrink-0 text-sm tabular-nums">{formatKcal(n.kcal)} kcal</span>
              <button
                type="button"
                className="btn-secondary h-9 w-9 shrink-0 px-0 text-sm"
                aria-label={`${t('journal.builder.remove')} ${i.name}`}
                onClick={() => setItems((xs) => xs.filter((x) => x.key !== i.key))}
              >
                ✕
              </button>
            </li>
          );
        })}
      </ul>
      {fields.ingredients && <p role="alert" className="mb-2 text-sm text-red-700">{fields.ingredients}</p>}
      <div className="mb-4 flex flex-wrap gap-2">
        <button type="button" className="btn-secondary" onClick={() => setMode({ kind: 'search' })}>
          {t('recipes.addIngredient')}
        </button>
        {water && (
          <button type="button" className="btn-secondary" onClick={() => setMode({ kind: 'qty', food: water })}>
            {t('recipes.addWater')}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-3">
        <Field label={t('recipes.servings')}>{(id) => <NumberInput id={id} value={servings} onChange={setServings} min={0} step="0.5" />}</Field>
        <Field label={t('recipes.yield')} help={t('recipes.yieldHelp')} error={fields.yieldUnit}>
          {(id) => (
            <div className="flex gap-2">
              <NumberInput id={id} value={yieldQty} onChange={setYieldQty} min={0} />
              <Segmented
                label={t('recipes.yield')}
                value={yieldUnit}
                onChange={setYieldUnit}
                options={[
                  { value: 'ml', label: 'ml' },
                  { value: 'g', label: 'g' },
                ]}
              />
            </div>
          )}
        </Field>
      </div>
      <label className="mb-1 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={homogeneous} onChange={(e) => setHomogeneous(e.target.checked)} />
        {t('recipes.homogeneous')}
      </label>
      {!homogeneous && <p className="mb-3 text-xs text-ink-faint">{t('recipes.homogeneousHelp')}</p>}
      <Field label={t('recipes.notes')}>
        {(id) => <textarea id={id} className="input min-h-[4rem]" value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} />}
      </Field>

      <section aria-label={t('recipes.total')} className="sticky bottom-0 mb-3 rounded-xl bg-surface-sunken p-3">
        {result ? (
          <>
            <NutrientRow label={t('recipes.total')} n={result.totals} strong />
            {result.perServing && <NutrientRow label={t('recipes.perServing')} n={result.perServing} />}
            {result.per100OfYield ? (
              <NutrientRow label={t('recipes.per100', { unit: result.per100OfYield.unit })} n={result.per100OfYield} />
            ) : (
              <p className="text-xs text-ink-faint">{t('recipes.per100Unknown')}</p>
            )}
          </>
        ) : (
          <p className="text-sm text-ink-faint">{t('recipes.noIngredients')}</p>
        )}
      </section>
      {initial && !asVariation && <p className="mb-2 text-xs text-ink-faint">{t('recipes.versionNote')}</p>}
      <ErrorNote message={error} />
      <button className="btn-primary w-full text-lg" disabled={busy || !name.trim() || items.length === 0}>
        {saveLabel ?? t('recipes.save')}
      </button>
      {initial && !asVariation && onDeleted && (
        <button type="button" className="btn-secondary mt-2 w-full text-red-700" onClick={remove}>
          {t('recipes.delete')}
        </button>
      )}
    </form>
  );
}
