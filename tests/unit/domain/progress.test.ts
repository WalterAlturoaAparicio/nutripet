import { describe, expect, it } from 'vitest';
import { periodSummary } from '@/domain/progress';

const day = (date: string, intakeKcal: number, expenditureKcal: number, hasFood = true) => ({ date, intakeKcal, expenditureKcal, hasFood, targetKcal: 2500 });

describe('periodSummary', () => {
  it('averages only over days with food entries and reports N of M', () => {
    const r = periodSummary([
      day('2026-11-02', 2000, 2400),
      day('2026-11-03', 2200, 2500),
      day('2026-11-04', 0, 2300, false),
      day('2026-11-05', 2600, 2400),
      day('2026-11-06', 1800, 2400),
      day('2026-11-07', 2400, 2600),
      day('2026-11-08', 0, 2300, false),
    ]);
    expect(r).toMatchObject({ daysWithData: 5, daysInPeriod: 7, avgIntakeKcal: 2200, avgExpenditureKcal: 2460, avgBalanceKcal: 260, balanceLabel: 'deficit', isEstimate: true });
    expect(r.series).toHaveLength(7);
    expect(r.series[2]).toEqual({ date: '2026-11-04', kcal: null, targetKcal: 2500 });
  });

  it('uses the dashboard sign convention for surplus', () => {
    expect(periodSummary([day('2026-11-01', 3000, 2500)]).balanceLabel).toBe('surplus');
  });

  it('empty period → nulls', () => {
    expect(periodSummary([day('2026-11-01', 0, 2000, false)])).toMatchObject({ daysWithData: 0, avgIntakeKcal: null, avgBalanceKcal: null, balanceLabel: null });
  });
});
