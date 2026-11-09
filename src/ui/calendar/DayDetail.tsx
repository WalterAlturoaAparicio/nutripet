'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { t } from '@/i18n/es';
import { api } from '@/ui/api';
import { Spinner } from '@/ui/kit';
import { formatKcal, formatQuantity, formatSigned } from '@/ui/format/units';
import { DayTotals } from '@/ui/journal/DayTotals';
import type { DaySummary } from '@/ui/types';

/** Read-only summary of a past day: meals, activities, totals and estimates (FR-065). */
export function DayDetail({ date }: { date: string }) {
  const [day, setDay] = useState<DaySummary | null>(null);
  useEffect(() => {
    setDay(null);
    api<DaySummary>('GET', `/api/v1/days/${date}`).then(setDay).catch(() => undefined);
  }, [date]);
  if (!day) return <Spinner />;
  return (
    <div>
      <p className="mb-2 text-sm text-ink-muted">{day.status && t(`calendar.states.${day.status}`)}</p>
      <DayTotals day={day} />
      {day.meals.map((m) => (
        <section key={m.id} className="mb-2">
          <h3 className="font-semibold">
            {t(`journal.occasions.${m.occasion}`)}
            {m.label ? ` · ${m.label}` : ''} <span className="text-sm font-normal text-ink-muted">{formatKcal(m.totals.kcal)} kcal</span>
          </h3>
          <ul className="text-sm text-ink-muted">
            {m.entries.map((e) => (
              <li key={e.id}>
                {e.name} · {formatQuantity(e.quantity, e.unit)} · {formatKcal(e.nutrients.kcal)} kcal
              </li>
            ))}
          </ul>
        </section>
      ))}
      {day.activities.length > 0 && (
        <section className="mb-2">
          <h3 className="font-semibold">{t('activity.title')}</h3>
          <ul className="text-sm text-ink-muted">
            {day.activities.map((a) => (
              <li key={a.id}>
                {a.name} · {a.durationMin} min · {a.estimateMethod === 'none' ? t('activity.noEstimate') : `${formatKcal(a.netKcal)} kcal (${t('common.estimated')})`}
              </li>
            ))}
          </ul>
        </section>
      )}
      {day.estimates && (
        <p className="text-sm">
          {t('dashboard.balance')}: <strong>{formatSigned(day.estimates.balanceKcal)} kcal</strong> ({t(`dashboard.${day.estimates.balanceLabel}`)})
        </p>
      )}
      <Link href={`/diario?date=${date}`} className="btn-secondary mt-3 w-full">
        {t('calendar.editDay')}
      </Link>
    </div>
  );
}
