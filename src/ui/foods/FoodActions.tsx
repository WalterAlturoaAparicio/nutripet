'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { t } from '@/i18n/es';
import { api, ClientApiError } from '@/ui/api';
import { ErrorNote, Sheet } from '@/ui/kit';
import { NutrientForm, nutrientPayload, type NutrientDraft } from '@/ui/foods/NutrientForm';

interface FoodLike {
  id: string;
  isFavorite: boolean;
  isCustom: boolean;
  hasOverride: boolean;
  per100: { basis: 'g' | 'ml'; kcal: number; proteinG: number; carbsG: number; fatG: number; fiberG: number | null; sugarG: number | null; sodiumMg: number | null; densityGPerMl: number | null };
}

/** Favorite star, "Corregir valores" (profile-only correction) and custom-food deletion (US4). */
export function FoodActions({ food, onChange }: { food: FoodLike; onChange: () => void }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<NutrientDraft | null>(null);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [error, setError] = useState<string | null>(null);

  const startEdit = () => {
    const p = food.per100;
    const n = (v: number | null) => (v === null ? '' : v);
    setDraft({ basis: p.basis, kcal: p.kcal, proteinG: p.proteinG, carbsG: p.carbsG, fatG: p.fatG, fiberG: n(p.fiberG), sugarG: n(p.sugarG), sodiumMg: n(p.sodiumMg), densityGPerMl: n(p.densityGPerMl) });
    setEditing(true);
  };

  async function save() {
    if (!draft) return;
    setError(null);
    try {
      if (food.isCustom) await api('PATCH', `/api/v1/foods/${food.id}`, { nutrients: nutrientPayload(draft) });
      else await api('POST', `/api/v1/foods/${food.id}/override`, nutrientPayload(draft));
      setEditing(false);
      onChange();
    } catch (e) {
      if (e instanceof ClientApiError && e.body.fields) setErrors(e.body.fields);
      setError(e instanceof ClientApiError ? (Object.values(e.body.fields ?? {})[0] ?? e.body.message) : t('errors.generic'));
    }
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button
        className="btn-secondary"
        aria-pressed={food.isFavorite}
        onClick={async () => {
          await api(food.isFavorite ? 'DELETE' : 'PUT', `/api/v1/foods/${food.id}/favorite`);
          onChange();
        }}
      >
        {food.isFavorite ? '★' : '☆'} {t('foods.favorites')}
      </button>
      <button className="btn-secondary" onClick={startEdit}>
        {food.isCustom ? t('common.edit') : t('foods.correct')}
      </button>
      {food.hasOverride && (
        <button
          className="btn-secondary"
          onClick={async () => {
            await api('DELETE', `/api/v1/foods/${food.id}/override`);
            onChange();
          }}
        >
          {t('foods.removeOverride')}
        </button>
      )}
      {food.isCustom && (
        <button
          className="btn-secondary text-red-700"
          onClick={async () => {
            await api('DELETE', `/api/v1/foods/${food.id}`);
            router.replace('/alimentos');
          }}
        >
          {t('common.delete')}
        </button>
      )}
      <Sheet open={editing} title={food.isCustom ? t('common.edit') : t('foods.correct')} onClose={() => setEditing(false)}>
        {draft && <NutrientForm value={draft} onChange={setDraft} errors={errors} />}
        {!food.isCustom && <p className="mb-3 text-xs text-ink-muted">Solo afecta a tu perfil y a tus registros nuevos.</p>}
        <ErrorNote message={error} />
        <button className="btn-primary w-full" onClick={save}>
          {t('common.save')}
        </button>
      </Sheet>
    </div>
  );
}
