'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Occasion } from '@/domain/types';
import { OCCASIONS } from '@/domain/types';
import { t } from '@/i18n/es';
import { api, ClientApiError } from '@/ui/api';
import { ErrorNote, Sheet, Spinner } from '@/ui/kit';
import { FoodSearch, StateChip } from '@/ui/foods/FoodSearch';
import { QuickAdd } from '@/ui/journal/QuickAdd';
import { QuantitySheet } from '@/ui/journal/QuantitySheet';
import { PortionPicker } from '@/ui/recipes/PortionPicker';
import { RecipeBuilder } from '@/ui/recipes/RecipeBuilder';
import {
  draftTotals,
  entryPortion,
  foodRow,
  newKey,
  recipeFacts,
  recipeRow,
  rowFromEntry,
  rowNutrients,
  summaryFromRow,
  toApiItem,
  type DraftItem,
} from '@/ui/journal/draft';
import { formatGrams, formatKcal, formatQuantity, type FoodUnit } from '@/ui/format/units';
import type { DaySummary, FoodSummary, MealView, PortionInput, RecipeView, TemplateView } from '@/ui/types';

export function defaultOccasion(now = new Date()): Occasion {
  const h = now.getHours();
  if (h < 10) return 'breakfast';
  if (h < 12) return 'morning_snack';
  if (h < 15) return 'lunch';
  if (h < 18) return 'afternoon_snack';
  return 'dinner';
}

type View =
  | { kind: 'list' }
  | { kind: 'qty'; food: FoodSummary; row?: DraftItem & { kind: 'food' }; prefill?: { quantity: number; unit: 'g' | 'ml' } }
  | { kind: 'portion'; recipe: RecipeView; row?: DraftItem & { kind: 'recipe' } }
  | { kind: 'recipe'; recipe?: RecipeView; variation?: boolean; seed?: FoodSummary };

interface FoodDetail {
  id: string;
  nameEs: string;
  preparationState: FoodSummary['preparationState'];
  productForm: FoodSummary['productForm'];
  hasOverride: boolean;
  source: { id: string };
  per100: { basis: 'g' | 'ml'; kcal: number; proteinG: number; carbsG: number; fatG: number; densityGPerMl: number | null };
}

const detailToSummary = (f: FoodDetail): FoodSummary => ({
  id: f.id,
  nameEs: f.nameEs,
  nameEn: null,
  category: '',
  preparationState: f.preparationState,
  productForm: f.productForm,
  brand: null,
  basis: f.per100.basis,
  densityGPerMl: f.per100.densityGPerMl,
  source: f.hasOverride ? 'user_correction' : f.source.id,
  kcalPer100: f.per100.kcal,
  proteinPer100: f.per100.proteinG,
  carbsPer100: f.per100.carbsG,
  fatPer100: f.per100.fatG,
  isFavorite: false,
  isCustom: false,
  hasOverride: f.hasOverride,
});

function MacroCells({ n, big }: { n: { kcal: number; proteinG: number; carbsG: number; fatG: number }; big?: boolean }) {
  return (
    <div className="grid grid-cols-4 gap-2 text-center">
      <div>
        <p className={`${big ? 'text-lg' : ''} font-bold tabular-nums`}>{formatKcal(n.kcal)}</p>
        <p className="text-xs text-ink-muted">kcal</p>
      </div>
      <div>
        <p className="font-semibold tabular-nums">{formatGrams(n.proteinG)} g</p>
        <p className="text-xs text-ink-muted">{t('dashboard.protein')}</p>
      </div>
      <div>
        <p className="font-semibold tabular-nums">{formatGrams(n.carbsG)} g</p>
        <p className="text-xs text-ink-muted">{t('dashboard.carbs')}</p>
      </div>
      <div>
        <p className="font-semibold tabular-nums">{formatGrams(n.fatG)} g</p>
        <p className="text-xs text-ink-muted">{t('dashboard.fat')}</p>
      </div>
    </div>
  );
}

function portionLabel(row: DraftItem & { kind: 'recipe' }, foodUnit: FoodUnit): string {
  const p = row.portion;
  if (p.mode === 'whole') return t('recipes.portion.whole');
  if (p.mode === 'servings') return `${formatGrams(p.servings)} ${t('recipes.portion.servingsOf', { total: row.facts.servings ?? '?' })}`;
  return `${formatQuantity(p.quantity, p.unit, foodUnit)} ${t('recipes.portion.amountOf', { total: row.facts.yield ? formatQuantity(row.facts.yield.quantity, row.facts.yield.unit, foodUnit) : '?' })}`;
}

/**
 * Meal builder (FR-035a): choose the occasion, add any number of foods and preparation portions,
 * review per-item values and the live meal total, edit or remove rows, then save the whole meal in
 * one request. Also edits an existing meal (`editMeal`). Search stays on the same screen, so adding
 * the next food never loses the rows already chosen (SC-001).
 */
export function AddFoodFlow({
  open,
  date,
  occasion: initialOccasion,
  foodUnit = 'metric',
  editMeal,
  onClose,
  onAdded,
}: {
  open: boolean;
  date: string;
  occasion?: Occasion;
  foodUnit?: FoodUnit;
  editMeal?: MealView;
  onClose: () => void;
  onAdded: (day: DaySummary) => void;
}) {
  const router = useRouter();
  const [occasion, setOccasion] = useState<Occasion>(editMeal?.occasion ?? initialOccasion ?? defaultOccasion());
  const [label, setLabel] = useState(editMeal?.label ?? '');
  const [rows, setRows] = useState<DraftItem[]>(() => (editMeal ? editMeal.entries.map(rowFromEntry).filter((r): r is DraftItem => r !== null) : []));
  const [loading, setLoading] = useState(Boolean(editMeal?.entries.some((e) => e.kind === 'recipe')));
  const [view, setView] = useState<View>({ kind: 'list' });
  const [recipes, setRecipes] = useState<RecipeView[]>([]);
  const [asTemplate, setAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [confirmLarge, setConfirmLarge] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [searchKey, setSearchKey] = useState(0);

  const loadRecipes = () => api<RecipeView[]>('GET', '/api/v1/recipes').then(setRecipes).catch(() => undefined);
  useEffect(() => {
    if (open) loadRecipes();
  }, [open]);

  // Existing recipe entries are edited against the exact version they were logged with (FR-046).
  useEffect(() => {
    if (!editMeal) return;
    const recipeEntries = editMeal.entries.filter((e) => e.kind === 'recipe' && e.recipe);
    if (!recipeEntries.length) return;
    Promise.all(
      recipeEntries.map((e) =>
        api<RecipeView>('GET', `/api/v1/recipes/${e.recipe!.recipeId}?versionId=${e.recipe!.recipeVersionId}`).then((r) => ({ ...recipeRow(r, entryPortion(e), e.id), name: e.name })),
      ),
    )
      .then((recipeRows) => {
        const byEntry = new Map(recipeRows.map((r) => [r.entryId, r]));
        setRows(editMeal.entries.map((e) => (e.kind === 'recipe' ? byEntry.get(e.id) : rowFromEntry(e))).filter((r): r is DraftItem => Boolean(r)));
      })
      .catch(() => setError(t('errors.generic')))
      .finally(() => setLoading(false));
  }, [editMeal]);

  const change = (fn: (rs: DraftItem[]) => DraftItem[]) => {
    setRows(fn);
    setDirty(true);
    setNotice(null);
  };
  const upsertRow = (next: DraftItem, replace?: DraftItem) => {
    change((rs) => (replace ? rs.map((r) => (r.key === replace.key ? { ...next, key: replace.key, entryId: replace.entryId } : r)) : [...rs, next]));
    setView({ kind: 'list' });
    setSearchKey((k) => k + 1);
  };

  async function loadTemplate(templateId: string) {
    setBusy(true);
    try {
      const tpl = await api<TemplateView>('GET', `/api/v1/templates/${templateId}`);
      const added = await Promise.all(
        tpl.items.map(async (it) => {
          if (it.kind === 'food') return foodRow(detailToSummary(await api<FoodDetail>('GET', `/api/v1/foods/${it.foodId}`)), it.quantity, it.unit);
          return recipeRow(await api<RecipeView>('GET', `/api/v1/recipes/${it.recipeId}`), it.portion);
        }),
      );
      change((rs) => [...rs, ...added]);
      setNotice(t('journal.builder.templateLoaded', { name: tpl.name }));
    } catch (e) {
      setError(e instanceof ClientApiError ? e.body.message : t('errors.generic'));
    } finally {
      setBusy(false);
    }
  }

  async function save(confirm = false) {
    setBusy(true);
    setError(null);
    const extraLabel = occasion === 'extra' ? { label: label.trim() || t('journal.occasions.extra') } : {};
    try {
      let day: DaySummary;
      if (editMeal) {
        if (rows.length === 0) {
          let last: { day: DaySummary } | null = null;
          for (const e of editMeal.entries) last = await api<{ day: DaySummary }>('DELETE', `/api/v1/entries/${e.id}`);
          day = last!.day;
        } else {
          day = (await api<{ day: DaySummary }>('PUT', `/api/v1/meals/${editMeal.id}`, { items: rows.map((r) => toApiItem(r, true)), ...(confirm ? { confirm: true } : {}) })).day;
        }
      } else {
        day = (
          await api<{ day: DaySummary }>('POST', `/api/v1/days/${date}/entries/batch`, {
            occasion,
            ...extraLabel,
            items: rows.map((r) => toApiItem(r, false)),
            ...(confirm ? { confirm: true } : {}),
          })
        ).day;
      }
      if (asTemplate && templateName.trim() && rows.length) {
        await api('POST', '/api/v1/templates', { name: templateName.trim(), items: rows.map((r) => toApiItem(r, false)) });
      }
      onAdded(day);
      onClose();
    } catch (e) {
      if (e instanceof ClientApiError && e.body.code === 'CONFIRM_REQUIRED') setConfirmLarge(true);
      else setError(e instanceof ClientApiError ? (Object.values(e.body.fields ?? {})[0] ?? e.body.message) : t('errors.generic'));
    } finally {
      setBusy(false);
    }
  }

  const close = () => {
    if (dirty && rows.length > 0 && view.kind === 'list') setConfirmDiscard(true);
    else onClose();
  };
  const back = () => setView({ kind: 'list' });
  const totals = draftTotals(rows);
  const rowErrors = rows.some((r) => rowNutrients(r).error);
  const title = editMeal ? t('journal.builder.editTitle') : t('journal.builder.title');

  let body: React.ReactNode;
  if (loading) body = <Spinner />;
  else if (confirmDiscard) {
    body = (
      <div>
        <p className="mb-4">{t('journal.builder.discardTitle')}</p>
        <div className="flex gap-2">
          <button className="btn-secondary flex-1" onClick={() => setConfirmDiscard(false)}>
            {t('journal.builder.keepEditing')}
          </button>
          <button className="btn-primary flex-1" onClick={onClose}>
            {t('journal.builder.discard')}
          </button>
        </div>
      </div>
    );
  } else if (confirmLarge) {
    body = (
      <div>
        <p className="mb-4">{t('journal.confirmLarge', { quantity: rows.filter((r) => r.kind === 'food').map((r) => `${(r as { quantity: number }).quantity} ${(r as { unit: string }).unit}`).join(', ') })}</p>
        <div className="flex gap-2">
          <button className="btn-secondary flex-1" onClick={() => setConfirmLarge(false)}>
            {t('common.back')}
          </button>
          <button className="btn-primary flex-1" disabled={busy} onClick={() => save(true)}>
            {t('common.confirm')}
          </button>
        </div>
      </div>
    );
  } else if (view.kind === 'qty') {
    body = (
      <>
        <button type="button" className="mb-2 text-sm underline" onClick={back}>
          ← {t('common.back')}
        </button>
        <QuantitySheet
          food={view.food}
          foodUnit={foodUnit}
          initialQuantity={view.row?.quantity ?? view.prefill?.quantity}
          initialUnit={view.row?.unit ?? view.prefill?.unit}
          confirmLabel={view.row ? t('journal.builder.update') : t('journal.builder.addToMeal')}
          onPrepare={(food) => setView({ kind: 'recipe', seed: food })}
          onConfirm={(v) => {
            const row = view.row;
            if (!row) return upsertRow(foodRow(v.food, v.quantity, v.unit));
            // A kept entry keeps its snapshot; only quantity/unit change (FR-033).
            if (row.entryId && v.foodId === row.foodId) return upsertRow({ ...row, quantity: v.quantity, unit: v.unit }, row);
            if (row.entryId) {
              // Switched to another variant: the old entry is removed and the new food is snapshotted now.
              change((rs) => rs.filter((r) => r.key !== row.key));
              return upsertRow(foodRow(v.food, v.quantity, v.unit));
            }
            upsertRow(foodRow(v.food, v.quantity, v.unit), row);
          }}
        />
      </>
    );
  } else if (view.kind === 'portion') {
    const facts = view.row?.facts ?? recipeFacts(view.recipe);
    body = (
      <>
        <button type="button" className="mb-2 text-sm underline" onClick={back}>
          ← {t('common.back')}
        </button>
        <PortionPicker
          name={view.recipe.name}
          facts={facts}
          initial={view.row?.portion}
          foodUnit={foodUnit}
          confirmLabel={view.row ? t('journal.builder.update') : t('journal.builder.addToMeal')}
          onConfirm={(portion: PortionInput) => upsertRow(view.row ? { ...view.row, portion } : recipeRow(view.recipe, portion), view.row)}
          onByIngredients={
            view.row
              ? undefined
              : () => {
                  // Non-uniform preparations: log the ingredients actually eaten, adjusting each quantity.
                  change((rs) => [
                    ...rs,
                    ...view.recipe.ingredients.map((i) => ({
                      key: newKey(),
                      kind: 'food' as const,
                      foodId: i.foodId,
                      name: i.name,
                      preparationState: i.preparationState,
                      productForm: i.productForm,
                      source: i.source,
                      quantity: i.quantity,
                      unit: i.unit,
                      ref: { ...i.per100 },
                    })),
                  ]);
                  back();
                }
          }
        />
        {view.recipe.isCurrentVersion && !view.row && (
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn-secondary flex-1 text-sm" onClick={() => setView({ kind: 'recipe', recipe: view.recipe })}>
              {t('recipes.edit')}
            </button>
            <button type="button" className="btn-secondary flex-1 text-sm" onClick={() => setView({ kind: 'recipe', recipe: view.recipe, variation: true })}>
              {t('recipes.variation')}
            </button>
          </div>
        )}
      </>
    );
  } else if (view.kind === 'recipe') {
    body = (
      <>
        <button type="button" className="mb-2 text-sm underline" onClick={back}>
          ← {t('common.back')}
        </button>
        <h3 className="mb-2 font-semibold">{view.recipe && !view.variation ? t('recipes.edit') : view.variation ? t('recipes.variation') : t('recipes.new')}</h3>
        <RecipeBuilder
          initial={view.recipe}
          asVariation={view.variation}
          seedFood={view.seed}
          foodUnit={foodUnit}
          saveLabel={t('recipes.saveAndUse')}
          onSaved={(r) => {
            loadRecipes();
            setView({ kind: 'portion', recipe: r });
          }}
          onDeleted={() => {
            loadRecipes();
            back();
          }}
        />
      </>
    );
  } else {
    body = (
      <>
        {!editMeal && (
          <div className="mb-3 flex flex-wrap gap-2" role="radiogroup" aria-label={t('journal.chooseOccasion')}>
            {OCCASIONS.map((o) => (
              <button
                key={o}
                type="button"
                role="radio"
                aria-checked={occasion === o}
                onClick={() => setOccasion(o)}
                className={`rounded-full px-3 py-2 text-sm ${occasion === o ? 'bg-ink text-white' : 'bg-surface-sunken'}`}
              >
                {t(`journal.occasions.${o}`)}
              </button>
            ))}
          </div>
        )}
        {editMeal && (
          <p className="mb-3 font-semibold">
            {t(`journal.occasions.${editMeal.occasion}`)}
            {editMeal.label ? ` · ${editMeal.label}` : ''}
          </p>
        )}
        {!editMeal && occasion === 'extra' && (
          <input className="input mb-3" placeholder={t('journal.extraLabel')} value={label} maxLength={40} onChange={(e) => setLabel(e.target.value)} />
        )}

        {rows.length === 0 ? (
          <p className="mb-3 text-sm text-ink-faint">{t('journal.builder.empty')}</p>
        ) : (
          <ul className="mb-3 divide-y divide-black/5 rounded-xl border border-black/5 px-3" aria-label={t('journal.builder.items', { count: rows.length })}>
            {rows.map((r) => {
              const n = rowNutrients(r);
              return (
                <li key={r.key} className="py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{r.name}</p>
                      <p className="flex flex-wrap items-center gap-1 text-xs text-ink-muted">
                        {r.kind === 'food' ? (
                          <>
                            <StateChip state={r.preparationState} /> {formatQuantity(r.quantity, r.unit, foodUnit)}
                            {n.approximate && ` · ${t('journal.approximate')}`}
                          </>
                        ) : (
                          <>
                            <span className="rounded-full bg-target-soft px-2 py-0.5 text-[11px] font-semibold">{t('foods.sources.recipe')}</span>
                            {portionLabel(r, foodUnit)}
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        className="btn-secondary h-9 px-2 text-xs"
                        aria-label={`${t('journal.builder.editItem')} ${r.name}`}
                        onClick={async () => {
                          if (r.kind === 'food') setView({ kind: 'qty', food: summaryFromRow(r), row: r });
                          else {
                            const recipe = await api<RecipeView>('GET', `/api/v1/recipes/${r.recipeId}?versionId=${r.recipeVersionId}`);
                            setView({ kind: 'portion', recipe, row: r });
                          }
                        }}
                      >
                        {t('journal.builder.editItem')}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary h-9 w-9 px-0 text-sm"
                        aria-label={`${t('journal.builder.remove')} ${r.name}`}
                        onClick={() => change((rs) => rs.filter((x) => x.key !== r.key))}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <div className="mt-1 text-xs">
                    {n.error ? (
                      <p role="alert" className="text-red-700">
                        {t('recipes.portion.exceeds')}
                      </p>
                    ) : (
                      <p className="tabular-nums text-ink-muted">
                        <strong className="text-ink">{formatKcal(n.nutrients.kcal)} kcal</strong> · P {formatGrams(n.nutrients.proteinG)} g · C {formatGrams(n.nutrients.carbsG)} g · G{' '}
                        {formatGrams(n.nutrients.fatG)} g
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <FoodSearch
          key={searchKey}
          autoFocus={rows.length === 0 && !editMeal}
          placeholder={rows.length ? t('journal.builder.addFood').replace('+ ', '') : undefined}
          onSelect={(food) => setView({ kind: 'qty', food })}
          onCreateCustom={(q) => router.push(`/alimentos/nuevo?name=${encodeURIComponent(q)}&returnTo=${encodeURIComponent(`/diario?date=${date}`)}`)}
          before={
            <>
              <div className="mt-3">
                <p className="label">{t('recipes.title')}</p>
                <div className="flex flex-wrap gap-2">
                  {recipes.map((r) => (
                    <button key={r.id} type="button" className="rounded-full bg-target-soft px-3 py-2 text-left text-sm" onClick={() => setView({ kind: 'portion', recipe: r })}>
                      🥤 {r.name} <span className="text-xs text-ink-muted">{formatKcal(r.totals.kcal)} kcal</span>
                    </button>
                  ))}
                  <button type="button" className="rounded-full border border-dashed border-ink/30 px-3 py-2 text-sm" onClick={() => setView({ kind: 'recipe' })}>
                    {t('recipes.new')}
                  </button>
                </div>
              </div>
              <QuickAdd onPick={(food, quantity, unit) => setView({ kind: 'qty', food, prefill: quantity && unit ? { quantity, unit } : undefined })} onTemplate={loadTemplate} />
            </>
          }
        />

        <div className="sticky bottom-0 -mx-4 mt-4 border-t border-black/5 bg-surface-raised px-4 pt-3">
          <section aria-label={t('journal.builder.mealTotal')} className="mb-3 rounded-xl bg-surface-sunken p-3">
            <p className="mb-1 text-xs font-semibold text-ink-muted">
              {t('journal.builder.mealTotal')} · {t('journal.builder.items', { count: rows.length })}
            </p>
            <MacroCells n={totals} big />
          </section>
          {rows.length > 0 && (
            <label className="mb-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={asTemplate} onChange={(e) => setAsTemplate(e.target.checked)} />
              {t('journal.builder.alsoTemplate')}
            </label>
          )}
          {asTemplate && (
            <input className="input mb-2" aria-label={t('journal.templateName')} placeholder={t('journal.templateName')} value={templateName} maxLength={40} onChange={(e) => setTemplateName(e.target.value)} />
          )}
          {notice && (
            <p role="status" className="mb-2 text-sm">
              {notice}
            </p>
          )}
          <ErrorNote message={error} />
          <button
            className="btn-primary w-full text-lg"
            disabled={busy || rowErrors || (!editMeal && rows.length === 0) || (asTemplate && !templateName.trim())}
            onClick={() => save()}
          >
            {editMeal ? t('journal.builder.saveChanges') : t('journal.builder.save')}
          </button>
        </div>
      </>
    );
  }

  return (
    <Sheet open={open} title={title} onClose={close}>
      {body}
      {view.kind !== 'list' && <ErrorNote message={error} />}
    </Sheet>
  );
}
