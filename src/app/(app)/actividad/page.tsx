'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { addDays } from '@/domain/dates';
import { t } from '@/i18n/es';
import { api } from '@/ui/api';
import { ErrorNote, Sheet, Spinner } from '@/ui/kit';
import { formatKcal } from '@/ui/format/units';
import { ActivityForm } from '@/ui/activity/ActivityForm';
import { useMe, useToday } from '@/ui/hooks';
import type { ActivityView, DaySummary } from '@/ui/types';

function ActivityInner() {
  const router = useRouter();
  const params = useSearchParams();
  const me = useMe();
  const today = useToday(me);
  const date = params.get('date') ?? today;
  const [day, setDay] = useState<DaySummary | null>(null);
  const [form, setForm] = useState<{ existing: ActivityView | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (date) setDay(await api<DaySummary>('GET', `/api/v1/days/${date}`));
  }, [date]);
  useEffect(() => {
    load().catch(() => setError(t('errors.generic')));
  }, [load]);

  if (!date || !today) return <Spinner />;
  const go = (d: string) => router.replace(d === today ? '/actividad' : `/actividad?date=${d}`);

  return (
    <div>
      <header className="mb-3 flex items-center justify-between gap-2 pr-12">
        <button className="btn-secondary h-11 w-11 px-0" aria-label="Día anterior" onClick={() => go(addDays(date, -1))}>
          ‹
        </button>
        <h1 className="text-lg font-bold">
          {t('activity.title')} · {date === today ? t('common.today') : date}
        </h1>
        <button className="btn-secondary h-11 w-11 px-0" aria-label="Día siguiente" disabled={date >= today} onClick={() => go(addDays(date, 1))}>
          ›
        </button>
      </header>
      <ErrorNote message={error} />
      {!day ? (
        <Spinner />
      ) : (
        <>
          <section className="card mb-3">
            {day.activities.length === 0 ? (
              <p className="text-ink-muted">{t('activity.empty')}</p>
            ) : (
              <ul className="divide-y divide-black/5">
                {day.activities.map((a) => (
                  <li key={a.id} className="flex min-h-touch items-center justify-between gap-2 py-2">
                    <button className="min-w-0 flex-1 text-left" onClick={() => setForm({ existing: a })}>
                      <span className="block font-medium">{a.name}</span>
                      <span className="text-xs text-ink-muted">
                        {a.durationMin} min
                        {a.intensity ? ` · ${t(`activity.intensities.${a.intensity}`)}` : ''}
                      </span>
                    </button>
                    <span className="text-right text-sm tabular-nums text-expenditure">
                      {a.estimateMethod === 'none' ? t('activity.noEstimate') : `${formatKcal(a.netKcal)} kcal`}
                      {a.estimateMethod !== 'none' && <span className="block text-[11px] text-ink-faint">{t('common.estimated')}</span>}
                    </span>
                    <button
                      className="btn-secondary h-11 w-11 px-0 text-sm"
                      aria-label={`${t('common.delete')} ${a.name}`}
                      onClick={async () => setDay((await api<{ day: DaySummary }>('DELETE', `/api/v1/activities/${a.id}`)).day)}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <button className="btn-primary w-full" onClick={() => setForm({ existing: null })}>
            + {t('dashboard.addActivity')}
          </button>
        </>
      )}
      <Sheet open={form !== null} title={form?.existing ? t('common.edit') : t('dashboard.addActivity')} onClose={() => setForm(null)}>
        {form && day && (
          <ActivityForm
            date={date}
            weightKg={day.estimates?.inputs.weightKg ?? me?.currentWeightKg ?? 70}
            existing={form.existing}
            onSaved={(d) => {
              setDay(d);
              setForm(null);
            }}
          />
        )}
      </Sheet>
    </div>
  );
}

export default function ActivityPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ActivityInner />
    </Suspense>
  );
}
