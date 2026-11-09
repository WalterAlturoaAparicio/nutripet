'use client';

import { t } from '@/i18n/es';
import { api } from '@/ui/api';
import type { DaySummary } from '@/ui/types';

/** Optional "Marcar día completo" (never required) and "Día de descanso" toggles (FR-061, T100). */
export function DayFlags({ date, day, onChange }: { date: string; day: DaySummary; onChange: (d: DaySummary) => void }) {
  const flags = day.flags ?? { restDay: false, markedComplete: false };
  const toggle = async (key: 'restDay' | 'markedComplete') => {
    const r = await api<{ day: DaySummary }>('PUT', `/api/v1/days/${date}/flags`, { [key]: !flags[key] });
    onChange(r.day);
  };
  return (
    <section className="card mb-3 space-y-2">
      {day.status && (
        <p className="text-sm">
          <span className="text-ink-muted">Estado del día: </span>
          <strong>{t(`calendar.states.${day.status}`)}</strong>
        </p>
      )}
      <label className="flex min-h-touch items-center justify-between gap-3">
        <span>
          <span className="block font-medium">{t('journal.markComplete')}</span>
          <span className="block text-xs text-ink-muted">{t('journal.markCompleteHelp')}</span>
        </span>
        <input type="checkbox" className="h-6 w-6" checked={flags.markedComplete} onChange={() => toggle('markedComplete')} />
      </label>
      <label className="flex min-h-touch items-center justify-between gap-3">
        <span className="font-medium">{t('journal.restDay')}</span>
        <input type="checkbox" className="h-6 w-6" checked={flags.restDay} onChange={() => toggle('restDay')} />
      </label>
    </section>
  );
}
