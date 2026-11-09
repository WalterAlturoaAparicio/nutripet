'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { addDays } from '@/domain/dates';
import { OCCASIONS, type Occasion } from '@/domain/types';
import { t } from '@/i18n/es';
import { api, ClientApiError } from '@/ui/api';
import { ErrorNote, Sheet, Spinner } from '@/ui/kit';
import { formatKcal, formatQuantity } from '@/ui/format/units';
import { AddFoodFlow } from '@/ui/journal/AddFoodFlow';
import { DayTotals } from '@/ui/journal/DayTotals';
import { QuantitySheet } from '@/ui/journal/QuantitySheet';
import { StateChip } from '@/ui/foods/FoodSearch';
import { DayFlags } from '@/ui/journal/DayFlags';
import { useMe, useToday } from '@/ui/hooks';
import type { DaySummary, EntryView, FoodSummary, MealView } from '@/ui/types';

function formatDay(date: string, today: string): string {
  if (date === today) return t('common.today');
  if (date === addDays(today, -1)) return t('common.yesterday');
  return new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
}

function JournalInner() {
  const router = useRouter();
  const params = useSearchParams();
  const me = useMe();
  const today = useToday(me);
  const date = params.get('date') ?? today;
  const [day, setDay] = useState<DaySummary | null>(null);
  const [adding, setAdding] = useState<Occasion | null>(null);
  const [editing, setEditing] = useState<{ entry: EntryView; food: FoodSummary } | null>(null);
  const [mealAction, setMealAction] = useState<MealView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!date) return;
    setDay(await api<DaySummary>('GET', `/api/v1/days/${date}`));
  }, [date]);

  useEffect(() => {
    setDay(null);
    load().catch(() => setError(t('errors.generic')));
  }, [load]);

  if (!date || !today) return <Spinner />;
  const go = (d: string) => router.replace(d === today ? '/diario' : `/diario?date=${d}`);

  function openEdit(entry: EntryView) {
    // The preview uses the entry's own snapshot; the server also recomputes from it (FR-033).
    setEditing({
      entry,
      food: {
        id: entry.foodId, nameEs: entry.name, nameEn: null, category: '', preparationState: entry.preparationState,
        brand: entry.brand, basis: entry.per100.basis, densityGPerMl: entry.per100.densityGPerMl, source: entry.source,
        kcalPer100: entry.per100.kcal, proteinPer100: entry.per100.proteinG, carbsPer100: entry.per100.carbsG,
        fatPer100: entry.per100.fatG, isFavorite: false, isCustom: false, hasOverride: false,
      },
    });
  }

  async function saveEdit(v: { foodId: string; quantity: number; unit: 'g' | 'ml' }) {
    if (!editing) return;
    const body: Record<string, unknown> = { quantity: v.quantity, unit: v.unit, confirm: true };
    if (v.foodId !== editing.entry.foodId) body.foodId = v.foodId;
    try {
      const r = await api<{ day: DaySummary }>('PATCH', `/api/v1/entries/${editing.entry.id}`, body);
      setDay(r.day);
      setEditing(null);
    } catch (e) {
      setError(e instanceof ClientApiError ? e.body.message : t('errors.generic'));
    }
  }

  async function remove(entry: EntryView) {
    // Optimistic: drop the entry locally, then reconcile with the server's totals (FR-034).
    setDay((d) => d && { ...d, meals: d.meals.map((m) => ({ ...m, entries: m.entries.filter((e) => e.id !== entry.id) })) });
    setEditing(null);
    try {
      setDay((await api<{ day: DaySummary }>('DELETE', `/api/v1/entries/${entry.id}`)).day);
    } catch {
      load();
    }
  }

  const mealsByOccasion = (o: Occasion) => day?.meals.filter((m) => m.occasion === o) ?? [];

  return (
    <div>
      <header className="mb-3 flex items-center justify-between gap-2 pr-12">
        <button className="btn-secondary h-11 w-11 px-0" aria-label="Día anterior" onClick={() => go(addDays(date, -1))}>
          ‹
        </button>
        <h1 className="text-center text-lg font-bold capitalize">{formatDay(date, today)}</h1>
        <button className="btn-secondary h-11 w-11 px-0" aria-label="Día siguiente" disabled={date >= today} onClick={() => go(addDays(date, 1))}>
          ›
        </button>
      </header>
      <ErrorNote message={error} />
      {!day ? (
        <Spinner />
      ) : (
        <>
          <DayTotals day={day} />
          {OCCASIONS.map((o) => {
            const meals = mealsByOccasion(o);
            return (
              <section key={o} className="card mb-3">
                {(meals.length ? meals : [null]).map((m, i) => (
                  <div key={m?.id ?? `${o}-${i}`} className={i > 0 ? 'mt-3 border-t border-black/5 pt-3' : ''}>
                    <div className="flex items-center justify-between">
                      <h2 className="font-semibold">
                        {t(`journal.occasions.${o}`)}
                        {m?.label ? ` · ${m.label}` : ''}
                      </h2>
                      <div className="flex items-center gap-2">
                        {m && <span className="text-sm tabular-nums text-ink-muted">{formatKcal(m.totals.kcal)} kcal</span>}
                        {m && (
                          <button className="btn-secondary h-11 w-11 px-0 text-sm" aria-label={`Acciones ${t(`journal.occasions.${o}`)}`} onClick={() => setMealAction(m)}>
                            ⋯
                          </button>
                        )}
                      </div>
                    </div>
                    {m ? (
                      <ul className="mt-1 divide-y divide-black/5">
                        {m.entries.map((e) => (
                          <li key={e.id}>
                            <button className="flex min-h-touch w-full items-center justify-between gap-2 py-2 text-left" onClick={() => openEdit(e)}>
                              <span className="min-w-0">
                                <span className="block truncate">{e.name}</span>
                                <span className="flex items-center gap-1 text-xs text-ink-muted">
                                  <StateChip state={e.preparationState} /> {formatQuantity(e.quantity, e.unit, me?.profile.foodUnit)}
                                  {e.approximate && ` · ${t('journal.approximate')}`}
                                </span>
                              </span>
                              <span className="shrink-0 tabular-nums">{formatKcal(e.nutrients.kcal)} kcal</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-ink-faint">{t('journal.empty')}</p>
                    )}
                  </div>
                ))}
                <button className="mt-2 text-sm font-semibold text-target" onClick={() => setAdding(o)}>
                  + {t('journal.add')}
                </button>
              </section>
            );
          })}
          <DayFlags date={date} day={day} onChange={setDay} />
        </>
      )}

      <AddFoodFlow
        key={`${adding}-${date}`}
        open={adding !== null}
        date={date}
        occasion={adding ?? undefined}
        foodUnit={me?.profile.foodUnit}
        onClose={() => setAdding(null)}
        onAdded={setDay}
      />

      <Sheet open={editing !== null} title={t('common.edit')} onClose={() => setEditing(null)}>
        {editing && (
          <>
            <QuantitySheet
              food={editing.food}
              foodUnit={me?.profile.foodUnit}
              initialQuantity={editing.entry.quantity}
              initialUnit={editing.entry.unit}
              confirmLabel={t('common.save')}
              onConfirm={saveEdit}
            />
            <button className="btn-secondary mt-3 w-full text-red-700" onClick={() => remove(editing.entry)}>
              {t('common.delete')}
            </button>
          </>
        )}
      </Sheet>

      <MealActions meal={mealAction} date={date} onClose={() => setMealAction(null)} onDay={(d) => d.date === date && setDay(d)} />
    </div>
  );
}

function MealActions({ meal, date, onClose, onDay }: { meal: MealView | null; date: string; onClose: () => void; onDay: (d: DaySummary) => void }) {
  const [toDate, setToDate] = useState(date);
  const [toOccasion, setToOccasion] = useState<Occasion>(meal?.occasion ?? 'breakfast');
  const [name, setName] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    setToDate(date);
    setToOccasion(meal?.occasion ?? 'breakfast');
    setName(meal ? t(`journal.occasions.${meal.occasion}`) : '');
    setMsg(null);
  }, [meal, date]);
  if (!meal) return null;
  return (
    <Sheet open title={t(`journal.occasions.${meal.occasion}`)} onClose={onClose}>
      <h3 className="mb-2 font-semibold">{t('journal.duplicate')}</h3>
      <div className="mb-2 flex gap-2">
        <input type="date" className="input" value={toDate} onChange={(e) => setToDate(e.target.value)} aria-label={t('journal.duplicateTo')} />
        <select className="input" value={toOccasion} onChange={(e) => setToOccasion(e.target.value as Occasion)} aria-label={t('journal.chooseOccasion')}>
          {OCCASIONS.map((o) => (
            <option key={o} value={o}>
              {t(`journal.occasions.${o}`)}
            </option>
          ))}
        </select>
      </div>
      <button
        className="btn-primary mb-5 w-full"
        onClick={async () => {
          try {
            const r = await api<{ day: DaySummary }>('POST', `/api/v1/meals/${meal.id}/duplicate`, {
              toDate,
              toOccasion,
              ...(toOccasion === 'extra' ? { label: meal.label ?? t('journal.occasions.extra') } : {}),
            });
            onDay(r.day);
            onClose();
          } catch (e) {
            setMsg(e instanceof ClientApiError ? e.body.message : t('errors.generic'));
          }
        }}
      >
        {t('journal.duplicate')}
      </button>
      <h3 className="mb-2 font-semibold">{t('journal.saveTemplate')}</h3>
      <input className="input mb-2" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} aria-label={t('journal.templateName')} />
      <button
        className="btn-secondary w-full"
        disabled={!name.trim()}
        onClick={async () => {
          await api('POST', '/api/v1/templates', { name: name.trim(), fromMealId: meal.id });
          setMsg(`${t('journal.templates')}: «${name.trim()}» ✓`);
        }}
      >
        {t('journal.saveTemplate')}
      </button>
      {msg && (
        <p role="status" className="mt-3 text-sm">
          {msg}
        </p>
      )}
    </Sheet>
  );
}

export default function JournalPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <JournalInner />
    </Suspense>
  );
}
