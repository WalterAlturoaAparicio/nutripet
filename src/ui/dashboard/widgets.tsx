'use client';

import { t } from '@/i18n/es';
import { formatGrams, formatKcal, formatSigned } from '@/ui/format/units';
import type { DaySummary } from '@/ui/types';

/** Intake vs active target ring; colors distinguish intake (green), target (indigo), expenditure (orange). */
export function CalorieProgress({ day }: { day: DaySummary }) {
  const intake = day.totals.kcal;
  const target = day.target.activeKcal;
  const pct = target > 0 ? Math.min(intake / target, 1.5) : 0;
  const r = 52;
  const c = 2 * Math.PI * r;
  const remaining = day.target.remainingKcal;
  const text =
    Math.round(remaining) === 0
      ? t('dashboard.atTarget')
      : remaining > 0
        ? t('dashboard.remaining', { kcal: formatKcal(remaining) })
        : t('dashboard.over', { kcal: formatKcal(-remaining) });
  return (
    <section className="card flex items-center gap-4" aria-label={t('dashboard.consumed')}>
      <svg width="128" height="128" viewBox="0 0 128 128" role="img" aria-label={`${formatKcal(intake)} / ${formatKcal(target)} kcal`}>
        <circle cx="64" cy="64" r={r} fill="none" stroke="#e1e4fa" strokeWidth="12" />
        <circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          stroke={pct > 1 ? '#e07a1f' : '#0f9d76'}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${Math.min(pct, 1) * c} ${c}`}
          transform="rotate(-90 64 64)"
        />
        <text x="64" y="62" textAnchor="middle" className="fill-ink text-[22px] font-bold">
          {formatKcal(intake)}
        </text>
        <text x="64" y="82" textAnchor="middle" className="fill-ink-muted text-[11px]">
          / {formatKcal(target)} kcal
        </text>
      </svg>
      <div className="min-w-0">
        <p className="text-sm text-ink-muted">{t('dashboard.consumed')}</p>
        <p className="text-2xl font-bold tabular-nums text-intake">{formatKcal(intake)} kcal</p>
        <p className="text-sm text-target">
          {t('dashboard.target')}: {formatKcal(target)} kcal{day.target.isOverride ? ` (${t('estimates.override')})` : ''}
        </p>
        <p className="mt-1 text-sm font-medium">{text}</p>
      </div>
    </section>
  );
}

function Bar({ label, value, target, color }: { label: string; value: number; target: number | null; color: string }) {
  const pct = target ? Math.min(value / target, 1) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-ink-muted">
          {formatGrams(value)}
          {target ? ` / ${formatGrams(target)}` : ''} g
        </span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-surface-sunken" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemax={target ?? undefined} aria-label={label}>
        <div className={`h-2 rounded-full ${color}`} style={{ width: target ? `${pct}%` : value > 0 ? '100%' : '0%', opacity: target ? 1 : 0.35 }} />
      </div>
    </div>
  );
}

export function MacroBars({ day }: { day: DaySummary }) {
  return (
    <section className="card mt-3 space-y-2">
      <Bar label={t('dashboard.protein')} value={day.totals.proteinG} target={day.target.proteinG} color="bg-target" />
      <Bar label={t('dashboard.carbs')} value={day.totals.carbsG} target={day.target.carbsG} color="bg-intake" />
      <Bar label={t('dashboard.fat')} value={day.totals.fatG} target={day.target.fatG} color="bg-expenditure" />
    </section>
  );
}

export function EnergyBalanceCard({ day, children }: { day: DaySummary; children?: React.ReactNode }) {
  const e = day.estimates;
  if (!e) return null;
  return (
    <section className="card mt-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-ink-muted">{t('dashboard.expenditure')}</h2>
        <p className="text-xl font-bold tabular-nums text-expenditure">
          {formatKcal(e.expenditureKcal)} kcal <span className="text-xs font-normal text-ink-faint">({t('common.estimated')})</span>
        </p>
      </div>
      <p className="text-xs text-ink-muted">
        {t('dashboard.baseline')}: {formatKcal(e.baselineTdeeKcal)} · {t('dashboard.exercise')}: +{formatKcal(e.activityNetKcal)}
      </p>
      <div className="mt-3 flex items-baseline justify-between border-t border-black/5 pt-3">
        <h2 className="text-sm font-semibold text-ink-muted">{t('dashboard.balance')}</h2>
        <p className="text-right">
          <span className="text-xl font-bold tabular-nums">{formatSigned(e.balanceKcal)} kcal</span>
          <span className="block text-sm">{t(`dashboard.${e.balanceLabel}`)}</span>
        </p>
      </div>
      <p className="mt-1 text-[11px] text-ink-faint">{t('estimates.balanceNote')}</p>
      {children}
    </section>
  );
}
