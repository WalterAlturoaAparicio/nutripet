'use client';

import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { t } from '@/i18n/es';
import { api } from '@/ui/api';
import { Segmented } from '@/ui/kit';
import { formatKcal, formatSigned } from '@/ui/format/units';

interface Summary {
  start: string;
  end: string;
  daysWithData: number;
  daysInPeriod: number;
  avgIntakeKcal: number | null;
  avgExpenditureKcal: number | null;
  avgTargetKcal: number | null;
  avgBalanceKcal: number | null;
  balanceLabel: 'deficit' | 'surplus' | 'maintenance' | null;
  series: { date: string; kcal: number | null; targetKcal: number }[];
}

export function IntakeChart({ series, target }: { series: Summary['series']; target: number | null }) {
  const data = series.map((d) => ({ day: d.date.slice(8), kcal: d.kcal === null ? 0 : Math.round(d.kcal) }));
  return (
    <div className="h-48 w-full" role="img" aria-label="Consumo diario de calorías">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid stroke="#eee" vertical={false} />
          <XAxis dataKey="day" fontSize={11} />
          <YAxis fontSize={11} />
          <Tooltip formatter={(v) => [`${v} kcal`, t('dashboard.consumed')]} />
          {target !== null && <ReferenceLine y={Math.round(target)} stroke="#4f5bd5" strokeDasharray="6 4" />}
          <Bar dataKey="kcal" fill="#0f9d76" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Weekly/monthly averages; every energy figure is labeled as an estimate (T116). */
export function ProgressSummaries({ today }: { today: string }) {
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const [s, setS] = useState<Summary | null>(null);
  useEffect(() => {
    api<Summary>('GET', `/api/v1/progress?period=${period}&end=${today}`).then(setS).catch(() => undefined);
  }, [period, today]);

  return (
    <section className="card">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{t('progress.title')}</h2>
        <Segmented
          label="Periodo"
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'week', label: t('progress.week') },
            { value: 'month', label: t('progress.month') },
          ]}
        />
      </div>
      {s &&
        (s.daysWithData === 0 ? (
          <p className="text-sm text-ink-muted">{t('progress.noData')}</p>
        ) : (
          <>
            <p className="mb-2 text-xs text-ink-muted">{t('progress.basedOn', { n: s.daysWithData, m: s.daysInPeriod })}</p>
            <dl className="mb-3 grid grid-cols-3 gap-2 text-center">
              <div>
                <dt className="text-xs text-ink-muted">{t('progress.avgIntake')}</dt>
                <dd className="font-bold text-intake">{formatKcal(s.avgIntakeKcal!)}</dd>
                <dd className="text-[11px] text-ink-faint">
                  {t('dashboard.target')}: {formatKcal(s.avgTargetKcal!)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">{t('progress.avgExpenditure')}</dt>
                <dd className="font-bold text-expenditure">{formatKcal(s.avgExpenditureKcal!)}</dd>
                <dd className="text-[11px] text-ink-faint">{t('common.estimated')}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">{t('progress.avgBalance')}</dt>
                <dd className="font-bold">{formatSigned(s.avgBalanceKcal!)}</dd>
                <dd className="text-[11px] text-ink-faint">{s.balanceLabel && t(`dashboard.${s.balanceLabel}`)}</dd>
              </div>
            </dl>
            <IntakeChart series={s.series} target={s.avgTargetKcal} />
            <p className="mt-2 text-[11px] text-ink-faint">{t('estimates.balanceNote')}</p>
          </>
        ))}
    </section>
  );
}
