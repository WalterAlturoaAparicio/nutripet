import { describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { asProfile, call, setToday, useFreshDb } from './helpers/db';
import { createOne } from './helpers/fixtures';
import { seedFoods } from './helpers/foods';
import { POST as addEntryRoute } from '@/app/api/v1/days/[date]/entries/route';
import { POST as addActivityRoute } from '@/app/api/v1/days/[date]/activities/route';
import { PUT as flagsRoute } from '@/app/api/v1/days/[date]/flags/route';
import { GET as calendarRoute } from '@/app/api/v1/calendar/route';
import { DELETE as deleteEntryRoute } from '@/app/api/v1/entries/[id]/route';
import { db } from '@/server/db/client';
import { dayLog } from '@/server/db/schema';

useFreshDb();

type Jar = Record<string, string>;
const OCC = ['breakfast', 'lunch', 'dinner'] as const;

async function logFood(jar: Jar, date: string, foodId: string, occasions: readonly string[] = OCC) {
  const ids: string[] = [];
  for (const occasion of occasions) {
    const r = await call(addEntryRoute, { jar, params: { date }, body: { occasion, foodId, quantity: 50, unit: 'g' } });
    ids.push(r.body.entry.id);
  }
  return ids;
}

describe('calendar and day states', () => {
  it('day status, flags and day summary are consistent', async () => {
    setToday('2026-11-08');
    const ids = seedFoods();
    const a = await createOne();
    const [, second] = await logFood(a.jar, '2026-11-08', ids.egg!, ['breakfast', 'lunch']);
    let day = (await call(flagsRoute, { method: 'PUT', jar: a.jar, params: { date: '2026-11-08' }, body: { restDay: true } })).body.day;
    expect(day.status).toBe('food_partial');
    day = (await call(flagsRoute, { method: 'PUT', jar: a.jar, params: { date: '2026-11-08' }, body: { markedComplete: true } })).body.day;
    expect(day).toMatchObject({ status: 'rest_completed', foodCompleted: true, flags: { restDay: true, markedComplete: true } });
    const act = await call(addActivityRoute, { jar: a.jar, params: { date: '2026-11-08' }, body: { activityTypeId: 'builtin:walking', durationMin: 20, estimateMethod: 'none' } });
    expect(act.body.day.status).toBe('full_completed');

    const first = () => db().select().from(dayLog).where(and(eq(dayLog.profileId, a.id), eq(dayLog.localDate, '2026-11-08'))).get()!.firstCompletedAt;
    expect(first()).not.toBeNull();
    await call(flagsRoute, { method: 'PUT', jar: a.jar, params: { date: '2026-11-08' }, body: { markedComplete: false } });
    expect(first()).toBeNull();
    void second;
  });

  it('activity-only days are their own state and do not count as completed', async () => {
    setToday('2026-11-08');
    const a = await createOne();
    await call(addActivityRoute, { jar: a.jar, params: { date: '2026-11-08' }, body: { activityTypeId: 'builtin:walking', durationMin: 20, estimateMethod: 'none' } });
    const cal = (await call(calendarRoute, { jar: a.jar, url: '/api/v1/calendar?month=2026-11' })).body;
    expect(cal.days.find((d: any) => d.date === '2026-11-08')).toMatchObject({ status: 'activity_only', hasActivity: true });
    expect(cal.streak).toMatchObject({ current: 0, totalRecordedDays: 1, totalCompletedDays: 0 });
  });

  it('backfilling recomputes the streak; monthly % uses elapsed days since the profile started', async () => {
    setToday('2026-11-01');
    const ids = seedFoods();
    const a = await createOne();
    setToday('2026-11-03', 20);
    const jar = asProfile(a.id);
    await logFood(jar, '2026-11-03', ids.egg!);
    let cal = (await call(calendarRoute, { jar, url: '/api/v1/calendar?month=2026-11' })).body;
    expect(cal.streak.current).toBe(1);
    expect(cal.monthCompletionPct).toBe(33);
    await logFood(jar, '2026-11-01', ids.egg!);
    await logFood(jar, '2026-11-02', ids.egg!);
    cal = (await call(calendarRoute, { jar, url: '/api/v1/calendar?month=2026-11' })).body;
    expect(cal.streak).toMatchObject({ current: 3, longest: 3, totalCompletedDays: 3 });
    expect(cal.monthCompletionPct).toBe(100);
    expect(cal.days).toHaveLength(30);
  });

  it('deleting entries can take a day out of completed', async () => {
    setToday('2026-11-08');
    const ids = seedFoods();
    const a = await createOne();
    const entries = await logFood(a.jar, '2026-11-08', ids.egg!);
    const del = await call(deleteEntryRoute, { method: 'DELETE', jar: a.jar, params: { id: entries[2]! } });
    expect(del.body.day.status).toBe('food_partial');
    const cal = (await call(calendarRoute, { jar: a.jar, url: '/api/v1/calendar?month=2026-11' })).body;
    expect(cal.streak.totalCompletedDays).toBe(0);
  });

  it('rejects invalid months and future flags', async () => {
    setToday('2026-11-08');
    const a = await createOne();
    expect((await call(calendarRoute, { jar: a.jar, url: '/api/v1/calendar?month=2026-13' })).status).toBe(422);
    expect((await call(flagsRoute, { method: 'PUT', jar: a.jar, params: { date: '2026-11-09' }, body: { restDay: true } })).status).toBe(422);
  });
});
