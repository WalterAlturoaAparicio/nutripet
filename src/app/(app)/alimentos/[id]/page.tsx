'use client';

import Link from 'next/link';
import { use, useCallback, useEffect, useState } from 'react';
import { t } from '@/i18n/es';
import { api } from '@/ui/api';
import { ErrorNote, Spinner } from '@/ui/kit';
import { formatGrams, formatKcal } from '@/ui/format/units';
import { SourceBadge, StateChip } from '@/ui/foods/FoodSearch';
import { FoodActions } from '@/ui/foods/FoodActions';

export interface FoodDetail {
  id: string;
  nameEs: string;
  nameEn: string | null;
  aliases: { alias: string; lang: string }[];
  category: string;
  preparationState: 'raw' | 'cooked' | 'prepared' | 'packaged';
  brand: string | null;
  isCustom: boolean;
  isFavorite: boolean;
  hasOverride: boolean;
  sourceNote: string | null;
  sourceFoodId: string | null;
  per100: {
    basis: 'g' | 'ml';
    kcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    fiberG: number | null;
    sugarG: number | null;
    sodiumMg: number | null;
    densityGPerMl: number | null;
  };
  versionNo: number;
  source: { id: string; name: string; attribution: string; license: string };
  sourceVersion: string;
  updatedAt: string;
}

export default function FoodDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [food, setFood] = useState<FoodDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => api<FoodDetail>('GET', `/api/v1/foods/${id}`).then(setFood), [id]);

  useEffect(() => {
    load().catch(() => setError(t('errors.generic')));
  }, [load]);

  if (!food) return error ? <ErrorNote message={error} /> : <Spinner />;
  const p = food.per100;
  const rows: [string, string][] = [
    [t('foods.nutrients.kcal'), `${formatKcal(p.kcal)} kcal`],
    [t('foods.nutrients.protein'), `${formatGrams(p.proteinG)} g`],
    [t('foods.nutrients.carbs'), `${formatGrams(p.carbsG)} g`],
    [t('foods.nutrients.fat'), `${formatGrams(p.fatG)} g`],
    [t('foods.nutrients.fiber'), p.fiberG === null ? t('common.notAvailable') : `${formatGrams(p.fiberG)} g`],
    [t('foods.nutrients.sugar'), p.sugarG === null ? t('common.notAvailable') : `${formatGrams(p.sugarG)} g`],
    [t('foods.nutrients.sodium'), p.sodiumMg === null ? t('common.notAvailable') : `${formatKcal(p.sodiumMg)} mg`],
  ];

  return (
    <div>
      <Link href="/alimentos" className="text-sm underline">
        ← {t('foods.title')}
      </Link>
      <h1 className="mt-2 text-2xl font-bold">{food.nameEs}</h1>
      {food.nameEn && <p className="text-sm text-ink-muted">{food.nameEn}</p>}
      <p className="mt-2 flex flex-wrap items-center gap-1">
        <StateChip state={food.preparationState} />
        <SourceBadge source={food.hasOverride ? 'user_correction' : food.source.id} />
        <span className="text-xs text-ink-muted">{t(`foods.categories.${food.category}`)}</span>
        {food.brand && <span className="text-xs text-ink-muted">· {t('foods.brand')}: {food.brand}</span>}
      </p>

      <section className="card mt-4">
        <h2 className="mb-2 font-semibold">{p.basis === 'ml' ? t('foods.per100ml') : t('foods.per100g')}</h2>
        <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-ink-muted">{k}</dt>
              <dd className={`text-right tabular-nums ${v === t('common.notAvailable') ? 'text-ink-faint' : 'font-semibold'}`}>{v}</dd>
            </div>
          ))}
        </dl>
        {p.densityGPerMl && <p className="mt-2 text-xs text-ink-muted">Densidad: {p.densityGPerMl} g/ml</p>}
      </section>

      <FoodActions food={food} onChange={load} />

      <section className="card mt-4 text-sm">
        <h2 className="mb-2 font-semibold">{t('foods.source')}</h2>
        <p>{food.source.name}</p>
        {food.sourceFoodId && (
          <p className="text-ink-muted">
            {t('foods.sourceId')}: {food.sourceFoodId}
          </p>
        )}
        <p className="text-ink-muted">
          {t('foods.sourceVersion')}: {food.sourceVersion} · v{food.versionNo}
        </p>
        {food.sourceNote && <p className="mt-1 text-ink-muted">{food.sourceNote}</p>}
        <p className="mt-2 text-xs text-ink-faint">
          {food.source.attribution} ({food.source.license})
        </p>
      </section>
    </div>
  );
}
