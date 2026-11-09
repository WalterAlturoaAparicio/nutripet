/** Weight trend (FR-051, FR-052): progress is read from a smoothed trend, not from single-day changes. */
import { addDays } from '../dates';
import type { LocalDate, WeightRecordLike } from '../types';

export interface TrendPoint {
  date: LocalDate;
  trendKg: number;
}

export const MIN_POINTS_FOR_TREND = 3;

/** One value per day: the latest record of that day. */
export function dailyValues(records: WeightRecordLike[]): { date: LocalDate; weightKg: number }[] {
  const byDay = new Map<LocalDate, WeightRecordLike>();
  for (const r of records) {
    const cur = byDay.get(r.localDate);
    if (!cur || r.createdAt > cur.createdAt) byDay.set(r.localDate, r);
  }
  return [...byDay.values()].sort((a, b) => a.localDate.localeCompare(b.localDate)).map((r) => ({ date: r.localDate, weightKg: r.weightKg }));
}

/** Trailing moving average over the available daily values in [date − (window − 1), date]. */
export function movingAverageTrend(records: WeightRecordLike[], windowDays = 7): TrendPoint[] {
  const days = dailyValues(records);
  if (days.length < MIN_POINTS_FOR_TREND) return [];
  return days.map((d) => {
    const from = addDays(d.date, -(windowDays - 1));
    const inWindow = days.filter((x) => x.date >= from && x.date <= d.date);
    return { date: d.date, trendKg: inWindow.reduce((s, x) => s + x.weightKg, 0) / inWindow.length };
  });
}

export function latestOnOrBefore(records: WeightRecordLike[], date: LocalDate): WeightRecordLike | null {
  let best: WeightRecordLike | null = null;
  for (const r of records) {
    if (r.localDate > date) continue;
    if (!best || r.localDate > best.localDate || (r.localDate === best.localDate && r.createdAt > best.createdAt)) best = r;
  }
  return best;
}

/** Signed distance to target: positive = kg still to gain, negative = kg still to lose. */
export function toTarget(trendKg: number, targetKg: number): number {
  return targetKg - trendKg;
}

/** Change of the latest trend value versus the trend at or before `days` earlier; null without enough history. */
export function trendChange(trend: TrendPoint[], days: number): number | null {
  const last = trend.at(-1);
  if (!last) return null;
  const cutoff = addDays(last.date, -days);
  const earlier = [...trend].reverse().find((p) => p.date <= cutoff);
  return earlier ? last.trendKg - earlier.trendKg : null;
}
