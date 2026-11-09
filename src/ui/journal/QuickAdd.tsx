'use client';

import { useEffect, useState } from 'react';
import { t } from '@/i18n/es';
import { api } from '@/ui/api';
import { formatQuantity } from '@/ui/format/units';
import type { FoodSummary } from '@/ui/types';

interface QuickFood extends FoodSummary {
  lastQuantity: number | null;
  lastUnit: 'g' | 'ml' | null;
}
interface QuickLists {
  favorites: QuickFood[];
  frequent: QuickFood[];
  templates: { id: string; name: string; items: { name: string }[] }[];
}

/**
 * Favorites, frequent foods and templates shown before typing (SC-002): a food tap opens the quantity
 * sheet prefilled with the last quantity (tap 2: confirm); a template tap logs all its items at once.
 */
export function QuickAdd({
  onPick,
  onTemplate,
}: {
  onPick: (food: FoodSummary, quantity?: number, unit?: 'g' | 'ml') => void;
  onTemplate: (templateId: string) => void;
}) {
  const [lists, setLists] = useState<QuickLists | null>(null);
  useEffect(() => {
    api<QuickLists>('GET', '/api/v1/foods/quick').then(setLists).catch(() => undefined);
  }, []);
  if (!lists) return null;
  const frequent = lists.frequent.filter((f) => !lists.favorites.some((x) => x.id === f.id));
  const chip = (f: QuickFood) => (
    <button
      key={f.id}
      type="button"
      className="rounded-full bg-surface-sunken px-3 py-2 text-left text-sm"
      onClick={() => onPick(f, f.lastQuantity ?? undefined, f.lastUnit ?? undefined)}
    >
      {f.nameEs}
      {f.lastQuantity !== null && <span className="ml-1 text-xs text-ink-muted">{formatQuantity(f.lastQuantity, f.lastUnit ?? f.basis)}</span>}
    </button>
  );
  return (
    <div className="mt-3 space-y-3">
      {lists.templates.length > 0 && (
        <div>
          <p className="label">{t('journal.templates')}</p>
          <div className="flex flex-wrap gap-2">
            {lists.templates.map((tpl) => (
              <button key={tpl.id} type="button" className="rounded-full bg-target-soft px-3 py-2 text-sm" onClick={() => onTemplate(tpl.id)}>
                📋 {tpl.name} <span className="text-xs text-ink-muted">({tpl.items.length})</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {lists.favorites.length > 0 && (
        <div>
          <p className="label">★ {t('foods.favorites')}</p>
          <div className="flex flex-wrap gap-2">{lists.favorites.map(chip)}</div>
        </div>
      )}
      {frequent.length > 0 && (
        <div>
          <p className="label">{t('foods.frequent')}</p>
          <div className="flex flex-wrap gap-2">{frequent.map(chip)}</div>
        </div>
      )}
    </div>
  );
}
