'use client';

import { useEffect, useMemo, useState } from 'react';
import { activityNetKcal } from '@/domain/energy';
import type { Intensity } from '@/domain/types';
import { t } from '@/i18n/es';
import { api, ClientApiError } from '@/ui/api';
import { ErrorNote, NumberInput } from '@/ui/kit';
import { formatKcal } from '@/ui/format/units';
import type { ActivityView, DaySummary } from '@/ui/types';

interface ActivityType {
  id: string;
  nameEs: string;
  icon: string | null;
  metLight: number | null;
  metModerate: number | null;
  metVigorous: number | null;
  isCustom: boolean;
}

type Method = 'met' | 'manual' | 'none';

export function ActivityForm({
  date,
  weightKg,
  existing,
  onSaved,
}: {
  date: string;
  /** Weight used for the live preview (the day's snapshot weight). */
  weightKg: number;
  existing?: ActivityView | null;
  onSaved: (day: DaySummary) => void;
}) {
  const [types, setTypes] = useState<ActivityType[]>([]);
  const [typeId, setTypeId] = useState(existing?.activityTypeId ?? '');
  const [duration, setDuration] = useState<number | ''>(existing?.durationMin ?? 30);
  const [intensity, setIntensity] = useState<Intensity>(existing?.intensity ?? 'moderate');
  const [method, setMethod] = useState<Method>(existing?.estimateMethod ?? 'met');
  const [manual, setManual] = useState<number | ''>(existing?.estimateMethod === 'manual' ? existing.netKcal : '');
  const [customName, setCustomName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<ActivityType[]>('GET', '/api/v1/activity-types').then(setTypes).catch(() => setError(t('errors.generic')));
  }, []);

  const type = types.find((x) => x.id === typeId);
  const mets = type ? { light: type.metLight, moderate: type.metModerate, vigorous: type.metVigorous } : null;
  const hasMet = Boolean(mets && Object.values(mets).some((v) => v !== null));
  const effectiveMethod: Method = method === 'met' && type && !hasMet ? 'none' : method;

  const preview = useMemo(() => {
    if (effectiveMethod === 'none' || !duration) return 0;
    if (effectiveMethod === 'manual') return Number(manual || 0);
    const met = mets?.[intensity] ?? null;
    return met === null ? 0 : activityNetKcal({ met, weightKg, durationMin: Number(duration) });
  }, [effectiveMethod, duration, manual, mets, intensity, weightKg]);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      let activityTypeId = typeId;
      if (!activityTypeId && customName.trim()) {
        activityTypeId = (await api<ActivityType>('POST', '/api/v1/activity-types', { nameEs: customName.trim() })).id;
      }
      const body = {
        activityTypeId,
        durationMin: Number(duration),
        intensity: hasMet && effectiveMethod === 'met' ? intensity : null,
        estimateMethod: effectiveMethod,
        ...(effectiveMethod === 'manual' ? { manualKcal: Number(manual || 0) } : {}),
      };
      const r = existing
        ? await api<{ day: DaySummary }>('PATCH', `/api/v1/activities/${existing.id}`, body)
        : await api<{ day: DaySummary }>('POST', `/api/v1/days/${date}/activities`, body);
      onSaved(r.day);
    } catch (e) {
      setError(e instanceof ClientApiError ? (Object.values(e.body.fields ?? {})[0] ?? e.body.message) : t('errors.generic'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <p className="label">{t('activity.type')}</p>
      <div className="mb-3 grid grid-cols-3 gap-2">
        {types.map((x) => (
          <button
            key={x.id}
            type="button"
            aria-pressed={typeId === x.id}
            onClick={() => setTypeId(x.id)}
            className={`flex min-h-[64px] flex-col items-center justify-center rounded-xl p-2 text-xs ${typeId === x.id ? 'bg-ink text-white' : 'bg-surface-sunken'}`}
          >
            <span aria-hidden className="text-xl">
              {x.icon ?? '⭐'}
            </span>
            {x.nameEs}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={typeId === ''}
          onClick={() => setTypeId('')}
          className={`flex min-h-[64px] flex-col items-center justify-center rounded-xl p-2 text-xs ${typeId === '' ? 'bg-ink text-white' : 'bg-surface-sunken'}`}
        >
          <span aria-hidden className="text-xl">
            ＋
          </span>
          {t('activity.custom')}
        </button>
      </div>
      {typeId === '' && (
        <input className="input mb-3" placeholder={t('activity.custom')} value={customName} maxLength={40} onChange={(e) => setCustomName(e.target.value)} />
      )}

      <label className="label" htmlFor="duration">
        {t('activity.duration')}
      </label>
      <div className="mb-3 flex items-center gap-2">
        <button type="button" className="btn-secondary h-11 w-11 px-0" aria-label="−5" onClick={() => setDuration((d) => Math.max(1, Number(d || 0) - 5))}>
          −
        </button>
        <NumberInput id="duration" value={duration} onChange={setDuration} step="1" inputMode="numeric" min={1} max={600} />
        <button type="button" className="btn-secondary h-11 w-11 px-0" aria-label="+5" onClick={() => setDuration((d) => Math.min(600, Number(d || 0) + 5))}>
          +
        </button>
      </div>

      <p className="label">{t('activity.estimate')}</p>
      <div className="mb-3 flex flex-wrap gap-2" role="radiogroup">
        {(['met', 'manual', 'none'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={effectiveMethod === m}
            disabled={m === 'met' && Boolean(type) && !hasMet}
            onClick={() => setMethod(m)}
            className={`rounded-full px-3 py-2 text-sm disabled:opacity-40 ${effectiveMethod === m ? 'bg-ink text-white' : 'bg-surface-sunken'}`}
          >
            {t(m === 'met' ? 'activity.methodMet' : m === 'manual' ? 'activity.methodManual' : 'activity.methodNone')}
          </button>
        ))}
      </div>

      {effectiveMethod === 'met' && hasMet && (
        <div className="mb-3 flex gap-2" role="radiogroup" aria-label={t('activity.intensity')}>
          {(['light', 'moderate', 'vigorous'] as const)
            .filter((i) => mets?.[i] !== null)
            .map((i) => (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={intensity === i}
                onClick={() => setIntensity(i)}
                className={`flex-1 rounded-xl px-2 py-2 text-sm ${intensity === i ? 'bg-expenditure text-white' : 'bg-expenditure-soft'}`}
              >
                {t(`activity.intensities.${i}`)}
                <span className="block text-[11px] opacity-80">MET {mets?.[i]}</span>
              </button>
            ))}
        </div>
      )}
      {effectiveMethod === 'manual' && (
        <div className="mb-3">
          <label className="label" htmlFor="manual-kcal">
            {t('activity.manualKcal')}
          </label>
          <NumberInput id="manual-kcal" value={manual} onChange={setManual} step="10" inputMode="numeric" min={0} max={3000} />
        </div>
      )}

      <p className="mb-3 rounded-xl bg-expenditure-soft p-3 text-center font-semibold" aria-live="polite">
        {effectiveMethod === 'none' ? t('activity.noEstimate') : t('activity.netKcal', { kcal: formatKcal(preview) })}
      </p>
      <ErrorNote message={error} />
      <button className="btn-primary w-full" disabled={busy || !duration || (!typeId && !customName.trim())}>
        {t('common.save')}
      </button>
    </form>
  );
}
