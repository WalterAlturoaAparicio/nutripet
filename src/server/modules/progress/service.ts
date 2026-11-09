/** Builds per-day intake/expenditure from each day's energy snapshot and summarizes a period (US8). */
import { addDays, dateRange } from '@/domain/dates';
import { dailyEnergy } from '@/domain/energy';
import { periodSummary, type ProgressDay } from '@/domain/progress';
import type { LocalDate } from '@/domain/types';
import { getDbHandle } from '../../db/client';
import { getDayEnergy } from '../day-energy/service';
import { profileToday } from '../profiles/time';

export function progressSummary(profileId: string, period: 'week' | 'month', endParam?: LocalDate) {
  const today = profileToday(profileId);
  const end = endParam && endParam < today ? endParam : today;
  const start = period === 'week' ? addDays(end, -6) : `${end.slice(0, 7)}-01`;
  const sqlite = getDbHandle().sqlite;
  const intake = new Map(
    (
      sqlite
        .prepare('SELECT local_date AS d, sum(kcal) AS k FROM meal_entry WHERE profile_id = ? AND local_date BETWEEN ? AND ? GROUP BY local_date')
        .all(profileId, start, end) as { d: string; k: number }[]
    ).map((r) => [r.d, r.k]),
  );
  const activity = new Map(
    (
      sqlite
        .prepare('SELECT local_date AS d, sum(net_kcal) AS k FROM activity_entry WHERE profile_id = ? AND local_date BETWEEN ? AND ? GROUP BY local_date')
        .all(profileId, start, end) as { d: string; k: number }[]
    ).map((r) => [r.d, r.k]),
  );
  const days: ProgressDay[] = dateRange(start, end).map((date) => {
    const { snapshot } = getDayEnergy(profileId, date);
    const kcal = intake.get(date) ?? 0;
    const e = dailyEnergy({ baselineTdee: snapshot.baselineTdeeKcal, activityNetKcal: [activity.get(date) ?? 0], intakeKcal: kcal });
    return { date, intakeKcal: kcal, expenditureKcal: e.expenditureKcal, hasFood: intake.has(date), targetKcal: snapshot.activeTargetKcal };
  });
  return { period, start, end, ...periodSummary(days) };
}
