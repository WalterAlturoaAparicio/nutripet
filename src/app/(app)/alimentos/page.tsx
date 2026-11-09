'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { t } from '@/i18n/es';
import { api } from '@/ui/api';
import { Segmented } from '@/ui/kit';
import { FoodSearch, SourceBadge, StateChip } from '@/ui/foods/FoodSearch';
import { formatKcal } from '@/ui/format/units';
import type { FoodSummary } from '@/ui/types';

const CATEGORIES = [
  'cereales', 'carnes', 'pescados', 'huevos', 'lacteos', 'leguminosas', 'tuberculos_platanos', 'frutas', 'verduras',
  'grasas', 'azucares', 'bebidas', 'preparaciones', 'empacados', 'otros',
] as const;

function FoodList({ items }: { items: FoodSummary[] }) {
  const router = useRouter();
  if (items.length === 0) return <p className="py-4 text-sm text-ink-muted">—</p>;
  return (
    <ul className="divide-y divide-black/5">
      {items.map((f) => (
        <li key={f.id}>
          <button className="flex min-h-touch w-full items-center gap-3 py-2 text-left" onClick={() => router.push(`/alimentos/${f.id}`)}>
            <span className="min-w-0 flex-1">
              <span className="block truncate">{f.nameEs}</span>
              <span className="flex flex-wrap gap-1">
                <StateChip state={f.preparationState} />
                <SourceBadge source={f.source} />
              </span>
            </span>
            <span className="text-sm tabular-nums text-ink-muted">{formatKcal(f.kcalPer100)} kcal</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export default function FoodsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'all' | 'favorites' | 'mine'>('all');
  const [category, setCategory] = useState('');
  const [state, setState] = useState('');
  const [branded, setBranded] = useState('');
  const [filtered, setFiltered] = useState<FoodSummary[]>([]);
  const [favorites, setFavorites] = useState<FoodSummary[]>([]);
  const [mine, setMine] = useState<FoodSummary[]>([]);

  useEffect(() => {
    if (tab === 'favorites') api<{ favorites: FoodSummary[] }>('GET', '/api/v1/foods/quick').then((q) => setFavorites(q.favorites));
    if (tab === 'mine') api<FoodSummary[]>('GET', '/api/v1/foods/mine').then(setMine);
  }, [tab]);

  useEffect(() => {
    if (!category && !state && !branded) return setFiltered([]);
    const qs = new URLSearchParams({ limit: '50', ...(category && { category }), ...(state && { state }), ...(branded && { branded }) });
    api<{ items: FoodSummary[] }>('GET', `/api/v1/foods?${qs}`).then((r) => setFiltered(r.items));
  }, [category, state, branded]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between pr-12">
        <h1 className="text-2xl font-bold">{t('foods.title')}</h1>
        <Link href="/alimentos/nuevo" className="btn-secondary px-3 text-sm">
          + {t('foods.newFood')}
        </Link>
      </div>
      <Segmented
        label={t('foods.title')}
        value={tab}
        onChange={setTab}
        options={[
          { value: 'all', label: t('foods.all') },
          { value: 'favorites', label: t('foods.favorites') },
          { value: 'mine', label: t('foods.mine') },
        ]}
      />
      <section className="card mt-3">
        {tab === 'all' && (
          <>
            <FoodSearch
              autoFocus={false}
              onSelect={(f) => router.push(`/alimentos/${f.id}`)}
              onCreateCustom={(q) => router.push(`/alimentos/nuevo?name=${encodeURIComponent(q)}`)}
              before={
                <div className="mt-3">
                  <div className="grid grid-cols-3 gap-2">
                    <select className="input text-sm" aria-label={t('foods.category')} value={category} onChange={(e) => setCategory(e.target.value)}>
                      <option value="">{t('foods.category')}</option>
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {t(`foods.categories.${c}`)}
                        </option>
                      ))}
                    </select>
                    <select className="input text-sm" aria-label={t('foods.preparation')} value={state} onChange={(e) => setState(e.target.value)}>
                      <option value="">{t('foods.preparation')}</option>
                      {(['raw', 'cooked', 'prepared', 'packaged'] as const).map((s) => (
                        <option key={s} value={s}>
                          {t(`foods.states.${s}`)}
                        </option>
                      ))}
                    </select>
                    <select className="input text-sm" aria-label={t('foods.brand')} value={branded} onChange={(e) => setBranded(e.target.value)}>
                      <option value="">{t('foods.brand')}</option>
                      <option value="true">Con marca</option>
                      <option value="false">Genéricos</option>
                    </select>
                  </div>
                  {(category || state || branded) && <FoodList items={filtered} />}
                </div>
              }
            />
          </>
        )}
        {tab === 'favorites' && <FoodList items={favorites} />}
        {tab === 'mine' && <FoodList items={mine} />}
      </section>
      <p className="mt-4 text-center text-sm">
        <Link href="/alimentos/fuentes" className="underline">
          {t('foods.attribution')}
        </Link>
      </p>
    </div>
  );
}
