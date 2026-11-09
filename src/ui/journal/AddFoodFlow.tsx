'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Occasion } from '@/domain/types';
import { OCCASIONS } from '@/domain/types';
import { t } from '@/i18n/es';
import { api, ClientApiError } from '@/ui/api';
import { ErrorNote, Sheet } from '@/ui/kit';
import { FoodSearch } from '@/ui/foods/FoodSearch';
import { QuickAdd } from '@/ui/journal/QuickAdd';
import { QuantitySheet } from '@/ui/journal/QuantitySheet';
import type { FoodUnit } from '@/ui/format/units';
import type { DaySummary, FoodSummary } from '@/ui/types';

export function defaultOccasion(now = new Date()): Occasion {
  const h = now.getHours();
  if (h < 10) return 'breakfast';
  if (h < 12) return 'morning_snack';
  if (h < 15) return 'lunch';
  if (h < 18) return 'afternoon_snack';
  return 'dinner';
}

/** Occasion → search → grams → confirm, in ≤ 4 interactions (SC-001). */
export function AddFoodFlow({
  open,
  date,
  occasion: initialOccasion,
  foodUnit,
  onClose,
  onAdded,
}: {
  open: boolean;
  date: string;
  occasion?: Occasion;
  foodUnit?: FoodUnit;
  onClose: () => void;
  onAdded: (day: DaySummary) => void;
}) {
  const router = useRouter();
  const [occasion, setOccasion] = useState<Occasion>(initialOccasion ?? defaultOccasion());
  const [label, setLabel] = useState('');
  const [picked, setPicked] = useState<{ food: FoodSummary; quantity?: number; unit?: 'g' | 'ml' } | null>(null);
  const [confirmLarge, setConfirmLarge] = useState<{ foodId: string; quantity: number; unit: 'g' | 'ml' } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setPicked(null);
    setConfirmLarge(null);
    setError(null);
  }

  async function submit(v: { foodId: string; quantity: number; unit: 'g' | 'ml' }, confirm = false) {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ day: DaySummary }>('POST', `/api/v1/days/${date}/entries`, {
        occasion,
        ...(occasion === 'extra' ? { label: label || t('journal.occasions.extra') } : {}),
        ...v,
        ...(confirm ? { confirm: true } : {}),
      });
      onAdded(r.day);
      reset();
      onClose();
    } catch (e) {
      if (e instanceof ClientApiError && e.body.code === 'CONFIRM_REQUIRED') setConfirmLarge(v);
      else setError(e instanceof ClientApiError ? (Object.values(e.body.fields ?? {})[0] ?? e.body.message) : t('errors.generic'));
    } finally {
      setBusy(false);
    }
  }

  async function applyTemplate(templateId: string) {
    setBusy(true);
    try {
      const r = await api<{ day: DaySummary }>('POST', `/api/v1/templates/${templateId}/apply`, {
        date,
        occasion,
        ...(occasion === 'extra' ? { label: label || t('journal.occasions.extra') } : {}),
      });
      onAdded(r.day);
      onClose();
    } catch (e) {
      setError(e instanceof ClientApiError ? e.body.message : t('errors.generic'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      title={picked ? t(`journal.occasions.${occasion}`) : t('dashboard.addMeal')}
      onClose={() => {
        reset();
        onClose();
      }}
    >
      {!picked ? (
        <>
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
          {occasion === 'extra' && (
            <input className="input mb-3" placeholder={t('journal.extraLabel')} value={label} maxLength={40} onChange={(e) => setLabel(e.target.value)} />
          )}
          <FoodSearch
            onSelect={(food) => setPicked({ food })}
            onCreateCustom={(q) => router.push(`/alimentos/nuevo?name=${encodeURIComponent(q)}&returnTo=${encodeURIComponent(`/diario?date=${date}`)}`)}
            before={<QuickAdd onPick={(food, quantity, unit) => setPicked({ food, quantity, unit })} onTemplate={applyTemplate} />}
          />
        </>
      ) : confirmLarge ? (
        <div>
          <p className="mb-4">{t('journal.confirmLarge', { quantity: `${confirmLarge.quantity} ${confirmLarge.unit}` })}</p>
          <div className="flex gap-2">
            <button className="btn-secondary flex-1" onClick={() => setConfirmLarge(null)}>
              {t('common.back')}
            </button>
            <button className="btn-primary flex-1" disabled={busy} onClick={() => submit(confirmLarge, true)}>
              {t('common.confirm')}
            </button>
          </div>
        </div>
      ) : (
        <>
          <button type="button" className="mb-2 text-sm underline" onClick={() => setPicked(null)}>
            ← {t('common.back')}
          </button>
          <QuantitySheet food={picked.food} foodUnit={foodUnit} initialQuantity={picked.quantity} initialUnit={picked.unit} busy={busy} onConfirm={submit} />
        </>
      )}
      <ErrorNote message={error} />
    </Sheet>
  );
}
