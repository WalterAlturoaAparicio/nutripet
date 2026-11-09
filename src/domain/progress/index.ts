/** Weekly/monthly summaries (US8). Averages use only days with food entries; energy values are estimates. */
import { balanceLabel } from '../energy';
import type { BalanceLabel, LocalDate } from '../types';

export interface ProgressDay {
  date: LocalDate;
  intakeKcal: number;
  expenditureKcal: number;
  hasFood: boolean;
  targetKcal: number;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

export function periodSummary(days: ProgressDay[]) {
  const withData = days.filter((d) => d.hasFood);
  const avgIntake = avg(withData.map((d) => d.intakeKcal));
  const avgExpenditure = avg(withData.map((d) => d.expenditureKcal));
  const avgBalance = avgIntake === null || avgExpenditure === null ? null : avgExpenditure - avgIntake;
  return {
    daysWithData: withData.length,
    daysInPeriod: days.length,
    avgIntakeKcal: avgIntake,
    avgExpenditureKcal: avgExpenditure,
    avgTargetKcal: avg(withData.map((d) => d.targetKcal)),
    avgBalanceKcal: avgBalance,
    balanceLabel: (avgBalance === null ? null : balanceLabel(avgBalance)) as BalanceLabel | null,
    series: days.map((d) => ({ date: d.date, kcal: d.hasFood ? d.intakeKcal : null, targetKcal: d.targetKcal })),
    isEstimate: true as const,
  };
}
