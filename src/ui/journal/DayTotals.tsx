'use client';

import { t } from '@/i18n/es';
import { formatGrams, formatKcal } from '@/ui/format/units';
import type { DaySummary } from '@/ui/types';

export function DayTotals({ day }: { day: DaySummary }) {
  const { totals, incompleteNutrients } = day;
  return (
    <section className="card sticky top-2 z-10 mb-4" aria-label={t('journal.dayTotal')}>
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-ink-muted">{t('journal.dayTotal')}</h2>
        <p className="text-2xl font-bold tabular-nums text-intake">
          {formatKcal(totals.kcal)} <span className="text-sm font-normal text-ink-muted">/ {formatKcal(day.target.activeKcal)} kcal</span>
        </p>
      </div>
      <dl className="mt-1 grid grid-cols-3 text-center text-sm">
        <div>
          <dt className="text-xs text-ink-muted">{t('dashboard.protein')}</dt>
          <dd className="font-semibold tabular-nums">{formatGrams(totals.proteinG)} g</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">{t('dashboard.carbs')}</dt>
          <dd className="font-semibold tabular-nums">{formatGrams(totals.carbsG)} g</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">{t('dashboard.fat')}</dt>
          <dd className="font-semibold tabular-nums">{formatGrams(totals.fatG)} g</dd>
        </div>
      </dl>
      {incompleteNutrients.length > 0 && totals.kcal > 0 && (
        <p className="mt-1 text-[11px] text-ink-faint">
          {t('journal.incomplete', { nutrients: incompleteNutrients.map((n) => t(`foods.nutrients.${n}`).toLowerCase()).join(', ') })}
        </p>
      )}
    </section>
  );
}
