'use client';

import { t } from '@/i18n/es';

export type CalendarStatus = 'none' | 'activity_only' | 'food_partial' | 'food_completed' | 'full_completed' | 'rest_completed';

/** Color AND icon per state, so color is never the only indicator (T124). */
export const STATUS_STYLE: Record<CalendarStatus, { cls: string; icon: string }> = {
  none: { cls: 'bg-surface-sunken text-ink-faint', icon: '' },
  activity_only: { cls: 'bg-expenditure-soft text-ink', icon: '🏃' },
  food_partial: { cls: 'bg-intake-soft text-ink', icon: '◐' },
  food_completed: { cls: 'bg-intake/70 text-white', icon: '●' },
  full_completed: { cls: 'bg-intake text-white', icon: '★' },
  rest_completed: { cls: 'bg-target/70 text-white', icon: '☾' },
};

export interface CalendarDay {
  date: string;
  status: CalendarStatus;
  frozen: boolean;
  hasActivity: boolean;
}

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export function MonthGrid({ days, today, onSelect }: { days: CalendarDay[]; today: string; onSelect: (date: string) => void }) {
  const first = days[0];
  if (!first) return null;
  // Monday-first grid.
  const offset = (new Date(`${first.date}T00:00:00Z`).getUTCDay() + 6) % 7;
  return (
    <div>
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-xs text-ink-muted" aria-hidden>
        {WEEKDAYS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1" role="grid">
        {Array.from({ length: offset }, (_, i) => (
          <span key={`pad-${i}`} />
        ))}
        {days.map((d) => {
          const s = STATUS_STYLE[d.status];
          const future = d.date > today;
          return (
            <button
              key={d.date}
              type="button"
              disabled={future}
              onClick={() => onSelect(d.date)}
              aria-label={`${d.date}: ${t(`calendar.states.${d.status}`)}${d.frozen ? `, ${t('calendar.frozen')}` : ''}`}
              className={`relative flex aspect-square min-h-touch flex-col items-center justify-center rounded-lg text-xs ${future ? 'bg-transparent text-ink-faint' : s.cls} ${d.date === today ? 'ring-2 ring-ink' : ''}`}
            >
              <span className="font-semibold">{Number(d.date.slice(8))}</span>
              <span aria-hidden className="text-[10px] leading-none">
                {d.frozen ? '❄️' : s.icon}
                {d.status === 'food_partial' && d.hasActivity ? '🏃' : ''}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Legend() {
  return (
    <ul className="mt-3 grid grid-cols-2 gap-1 text-xs" aria-label={t('calendar.legend')}>
      {(Object.keys(STATUS_STYLE) as CalendarStatus[]).map((k) => (
        <li key={k} className="flex items-center gap-2">
          <span className={`inline-flex h-5 w-5 items-center justify-center rounded ${STATUS_STYLE[k].cls}`} aria-hidden>
            {STATUS_STYLE[k].icon}
          </span>
          {t(`calendar.states.${k}`)}
        </li>
      ))}
      <li className="flex items-center gap-2">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-surface-sunken" aria-hidden>
          ❄️
        </span>
        {t('calendar.frozen')}
      </li>
    </ul>
  );
}
