'use client';

import { useEffect, useRef, useState } from 'react';
import { t } from '@/i18n/es';
import { api } from '@/ui/api';
import { formatKcal } from '@/ui/format/units';
import type { FoodSummary } from '@/ui/types';

export function SourceBadge({ source }: { source: string }) {
  return (
    <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-medium text-ink-muted">
      {t(`foods.sources.${source}`)}
    </span>
  );
}

export function StateChip({ state }: { state: FoodSummary['preparationState'] }) {
  const tone = state === 'raw' ? 'bg-intake-soft' : state === 'cooked' ? 'bg-expenditure-soft' : 'bg-target-soft';
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}>{t(`foods.states.${state}`)}</span>;
}

/** Search-as-you-type over the local catalog (FR-022, SC-001). */
export function FoodSearch({
  onSelect,
  onCreateCustom,
  autoFocus = true,
  placeholder,
  before,
}: {
  onSelect: (food: FoodSummary) => void;
  onCreateCustom?: (query: string) => void;
  autoFocus?: boolean;
  placeholder?: string;
  /** Rendered while the query is empty (e.g. quick-add lists). */
  before?: React.ReactNode;
}) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<FoodSummary[]>([]);
  const [suggest, setSuggest] = useState(false);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const query = q.trim();
    if (!query) {
      setItems([]);
      setSuggest(false);
      return;
    }
    const n = ++seq.current;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const r = await api<{ items: FoodSummary[]; suggestCustomFood: boolean }>('GET', `/api/v1/foods?q=${encodeURIComponent(query)}&limit=20`);
        if (n !== seq.current) return;
        setItems(r.items);
        setSuggest(r.suggestCustomFood);
      } finally {
        if (n === seq.current) setLoading(false);
      }
    }, 150);
    return () => window.clearTimeout(timer);
  }, [q]);

  return (
    <div>
      <label className="sr-only" htmlFor="food-search">
        {t('foods.search')}
      </label>
      <input
        id="food-search"
        type="search"
        className="input text-lg"
        placeholder={placeholder ?? t('foods.searchPlaceholder')}
        autoFocus={autoFocus}
        autoComplete="off"
        enterKeyHint="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && items[0]) onSelect(items[0]);
        }}
      />
      {!q.trim() && before}
      <ul className="mt-2 divide-y divide-black/5" aria-busy={loading}>
        {items.map((f) => (
          <li key={f.id}>
            <button type="button" className="flex min-h-touch w-full items-center gap-3 py-2 text-left" onClick={() => onSelect(f)}>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {f.isFavorite && <span aria-label={t('foods.favorites')}>★ </span>}
                  {f.nameEs}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-1">
                  <StateChip state={f.preparationState} />
                  <SourceBadge source={f.source} />
                  {f.brand && <span className="text-[11px] text-ink-muted">{f.brand}</span>}
                </span>
              </span>
              <span className="shrink-0 text-right text-sm tabular-nums text-ink-muted">
                {formatKcal(f.kcalPer100)} kcal
                <span className="block text-[11px]">{f.basis === 'ml' ? t('foods.per100ml') : t('foods.per100g')}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {suggest && (
        <div className="mt-3 rounded-xl bg-surface-sunken p-3 text-sm">
          <p>{t('foods.noVerified', { query: q.trim() })}</p>
          {onCreateCustom && (
            <button type="button" className="btn-secondary mt-2 w-full bg-white" onClick={() => onCreateCustom(q.trim())}>
              {t('foods.createCustom')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
