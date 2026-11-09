'use client';

import { useCallback, useEffect, useState } from 'react';
import { t } from '@/i18n/es';
import { api } from '@/ui/api';
import { ErrorNote, Sheet, Spinner } from '@/ui/kit';
import { DayDetail } from '@/ui/calendar/DayDetail';
import { Legend, MonthGrid, type CalendarDay } from '@/ui/calendar/MonthGrid';
import { useMe, useToday } from '@/ui/hooks';

interface CalendarData {
  month: string;
  days: CalendarDay[];
  streak: { current: number; longest: number; totalRecordedDays: number; totalCompletedDays: number; freezesAvailable: number };
  monthCompletionPct: number;
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export default function CalendarPage() {
  const me = useMe();
  const today = useToday(me);
  const [month, setMonth] = useState<string | null>(null);
  const [data, setData] = useState<CalendarData | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (today && !month) setMonth(today.slice(0, 7));
  }, [today, month]);

  const load = useCallback(async () => {
    if (month) setData(await api<CalendarData>('GET', `/api/v1/calendar?month=${month}`));
  }, [month]);
  useEffect(() => {
    load().catch(() => setError(t('errors.generic')));
  }, [load]);

  if (!today || !month) return <Spinner />;
  const label = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`));

  return (
    <div>
      <h1 className="mb-3 pr-12 text-2xl font-bold">{t('calendar.title')}</h1>
      <ErrorNote message={error} />
      {data && (
        <section className="card mb-3 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-2xl font-bold">{data.streak.current}</p>
            <p className="text-xs text-ink-muted">{t('calendar.current')}</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{data.streak.longest}</p>
            <p className="text-xs text-ink-muted">{t('calendar.longest')}</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{data.monthCompletionPct}%</p>
            <p className="text-xs text-ink-muted">{t('calendar.monthPct')}</p>
          </div>
          <div>
            <p className="font-semibold">{data.streak.totalRecordedDays}</p>
            <p className="text-xs text-ink-muted">{t('calendar.recordedDays')}</p>
          </div>
          <div>
            <p className="font-semibold">{data.streak.totalCompletedDays}</p>
            <p className="text-xs text-ink-muted">{t('calendar.completedDays')}</p>
          </div>
          <div>
            <p className="font-semibold">❄️ {data.streak.freezesAvailable}</p>
            <p className="text-xs text-ink-muted">{t('calendar.freezes')}</p>
          </div>
        </section>
      )}
      <section className="card">
        <div className="mb-3 flex items-center justify-between">
          <button className="btn-secondary h-11 w-11 px-0" aria-label="Mes anterior" onClick={() => setMonth(shiftMonth(month, -1))}>
            ‹
          </button>
          <h2 className="font-semibold capitalize">{label}</h2>
          <button className="btn-secondary h-11 w-11 px-0" aria-label="Mes siguiente" disabled={month >= today.slice(0, 7)} onClick={() => setMonth(shiftMonth(month, 1))}>
            ›
          </button>
        </div>
        {data ? <MonthGrid days={data.days} today={today} onSelect={setSelected} /> : <Spinner />}
        <Legend />
      </section>
      <Sheet open={selected !== null} title={selected ?? ''} onClose={() => setSelected(null)}>
        {selected && <DayDetail date={selected} />}
      </Sheet>
    </div>
  );
}
