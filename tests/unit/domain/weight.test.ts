import { describe, expect, it } from 'vitest';
import { latestOnOrBefore, movingAverageTrend, toTarget, trendChange } from '@/domain/weight';
import type { WeightRecordLike } from '@/domain/types';

const rec = (localDate: string, weightKg: number, createdAt = `${localDate}T12:00:00Z`, id = `${localDate}-${weightKg}`): WeightRecordLike => ({
  id,
  localDate,
  weightKg,
  createdAt,
});

describe('movingAverageTrend', () => {
  it('is empty with fewer than 3 measurement days', () => {
    expect(movingAverageTrend([rec('2026-11-01', 70), rec('2026-11-02', 71)])).toEqual([]);
  });

  it('averages the available daily values in the last 7 days', () => {
    const t = movingAverageTrend([rec('2026-11-01', 70), rec('2026-11-03', 72), rec('2026-11-05', 71), rec('2026-11-10', 69)]);
    expect(t.map((p) => p.date)).toEqual(['2026-11-01', '2026-11-03', '2026-11-05', '2026-11-10']);
    expect(t[2]!.trendKg).toBeCloseTo(71, 9);
    // 11-10 window = 11-04..11-10 → 71 and 69.
    expect(t[3]!.trendKg).toBeCloseTo(70, 9);
  });

  it('uses the latest record of a day', () => {
    const t = movingAverageTrend([
      rec('2026-11-01', 70),
      rec('2026-11-02', 80, '2026-11-02T08:00:00Z', 'a'),
      rec('2026-11-02', 71, '2026-11-02T20:00:00Z', 'b'),
      rec('2026-11-03', 72),
    ]);
    expect(t[2]!.trendKg).toBeCloseTo(71, 9);
  });
});

describe('helpers', () => {
  it('latestOnOrBefore', () => {
    const rs = [rec('2026-11-01', 70), rec('2026-11-05', 72)];
    expect(latestOnOrBefore(rs, '2026-11-04')?.weightKg).toBe(70);
    expect(latestOnOrBefore(rs, '2026-10-01')).toBeNull();
  });

  it('toTarget is signed toward the target for gain and loss', () => {
    expect(toTarget(66, 70)).toBe(4);
    expect(toTarget(80, 72)).toBe(-8);
  });

  it('trendChange compares the latest trend with the trend `days` earlier', () => {
    const t = [
      { date: '2026-11-01', trendKg: 70 },
      { date: '2026-11-04', trendKg: 70.2 },
      { date: '2026-11-08', trendKg: 70.6 },
    ];
    expect(trendChange(t, 7)).toBeCloseTo(0.6, 9);
    expect(trendChange(t.slice(1), 7)).toBeNull();
  });
});
