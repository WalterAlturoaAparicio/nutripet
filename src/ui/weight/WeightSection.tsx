'use client';

import { useCallback, useEffect, useState } from 'react';
import { t } from '@/i18n/es';
import { api, ClientApiError } from '@/ui/api';
import { ErrorNote, Sheet } from '@/ui/kit';
import { formatWeight, type WeightUnit } from '@/ui/format/units';
import { WeightInput } from '@/ui/profile/ProfileFields';
import { WeightChart } from './WeightChart';

interface WeightData {
  records: { id: string; date: string; weightKg: number; note: string | null }[];
  trend: { date: string; trendKg: number }[];
  latestKg: number | null;
  trendKg: number | null;
  targetKg: number;
  toTargetKg: number | null;
  trendChange7dKg: number | null;
}

export function WeightSection({ unit, today, onChanged }: { unit: WeightUnit; today: string; onChanged?: () => void }) {
  const [data, setData] = useState<WeightData | null>(null);
  const [kg, setKg] = useState<number | ''>('');
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState<WeightData['records'][number] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => api<WeightData>('GET', '/api/v1/weights').then(setData), []);
  useEffect(() => {
    load().catch(() => setError(t('errors.generic')));
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (kg === '') return;
    setError(null);
    try {
      await api('POST', '/api/v1/weights', { date, weightKg: Math.round(kg * 10) / 10, note: note.trim() || null });
      setKg('');
      setNote('');
      await load();
      onChanged?.();
    } catch (err) {
      setError(err instanceof ClientApiError ? (Object.values(err.body.fields ?? {})[0] ?? err.body.message) : t('errors.generic'));
    }
  }

  const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${formatWeight(Math.abs(v), unit)}`;

  return (
    <section className="card mb-4">
      <h2 className="mb-2 text-lg font-semibold">{t('weight.title')}</h2>
      {data && (
        <>
          {data.trend.length > 0 ? (
            <>
              <WeightChart data={{ records: data.records, trend: data.trend, targetKg: data.targetKg }} unit={unit} />
              <p className="mt-2 text-sm">
                {data.trendKg !== null && (
                  <>
                    {t('weight.trend')}: <strong>{formatWeight(data.trendKg, unit)}</strong>
                  </>
                )}
                {data.trendChange7dKg !== null && <> · {t('weight.trendChange', { change: signed(data.trendChange7dKg) })}</>}
                {data.toTargetKg !== null && (
                  <>
                    {' · '}
                    {Math.abs(data.toTargetKg) < 0.1 ? t('weight.atTarget') : t('weight.toTarget', { kg: formatWeight(Math.abs(data.toTargetKg), unit) })}
                  </>
                )}
              </p>
            </>
          ) : (
            <p className="text-sm text-ink-muted">{t('weight.notEnough')}</p>
          )}
        </>
      )}

      <form onSubmit={add} className="mt-3 grid grid-cols-[1fr_auto] gap-2">
        <label htmlFor="new-weight" className="sr-only">{t('weight.record')}</label>
        <WeightInput id="new-weight" kg={kg} unit={unit} onChange={setKg} />
        <input type="date" className="input w-40" value={date} max={today} onChange={(e) => setDate(e.target.value)} aria-label="Fecha" />
        <input className="input col-span-2" placeholder={t('weight.note')} value={note} maxLength={280} onChange={(e) => setNote(e.target.value)} />
        <button className="btn-primary col-span-2" disabled={kg === ''}>
          {t('weight.record')}
        </button>
      </form>
      <ErrorNote message={error} />

      {data && data.records.length > 0 && (
        <details className="mt-3">
          <summary className="min-h-touch cursor-pointer py-2 text-sm font-semibold">{t('weight.history')}</summary>
          <ul className="divide-y divide-black/5 text-sm">
            {[...data.records].reverse().map((r) => (
              <li key={r.id}>
                <button className="flex min-h-touch w-full items-center justify-between py-2 text-left" onClick={() => setEditing(r)}>
                  <span>
                    {r.date}
                    {r.note && <span className="ml-2 text-ink-muted">{r.note}</span>}
                  </span>
                  <span className="tabular-nums">{formatWeight(r.weightKg, unit)}</span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <Sheet open={editing !== null} title={t('common.edit')} onClose={() => setEditing(null)}>
        {editing && (
          <EditWeight
            record={editing}
            unit={unit}
            today={today}
            onDone={async () => {
              setEditing(null);
              await load();
              onChanged?.();
            }}
          />
        )}
      </Sheet>
    </section>
  );
}

function EditWeight({ record, unit, today, onDone }: { record: { id: string; date: string; weightKg: number; note: string | null }; unit: WeightUnit; today: string; onDone: () => void }) {
  const [kg, setKg] = useState<number | ''>(record.weightKg);
  const [date, setDate] = useState(record.date);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      onDone();
    } catch (e) {
      setError(e instanceof ClientApiError ? e.body.message : t('errors.generic'));
    }
  };
  return (
    <div className="space-y-3">
      <WeightInput id="edit-weight" kg={kg} unit={unit} onChange={setKg} />
      <input type="date" className="input" value={date} max={today} onChange={(e) => setDate(e.target.value)} aria-label="Fecha" />
      <ErrorNote message={error} />
      <button className="btn-primary w-full" disabled={kg === ''} onClick={() => run(() => api('PATCH', `/api/v1/weights/${record.id}`, { weightKg: Math.round(Number(kg) * 10) / 10, date }))}>
        {t('common.save')}
      </button>
      <button className="btn-secondary w-full text-red-700" onClick={() => run(() => api('DELETE', `/api/v1/weights/${record.id}`))}>
        {t('common.delete')}
      </button>
    </div>
  );
}
