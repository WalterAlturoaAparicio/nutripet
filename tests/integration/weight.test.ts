import { describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { asProfile, call, setToday, useFreshDb } from './helpers/db';
import { createOne, setupTwoProfiles } from './helpers/fixtures';
import { DELETE as delRoute, PATCH as patchRoute } from '@/app/api/v1/weights/[id]/route';
import { GET as listRoute, POST as addRoute } from '@/app/api/v1/weights/route';
import { GET as meRoute, PATCH as mePatch } from '@/app/api/v1/me/route';
import { ensureDaySnapshot } from '@/server/modules/day-energy/service';
import { db } from '@/server/db/client';
import { dayEnergySnapshot } from '@/server/db/schema';

useFreshDb();

describe('weight history', () => {
  it('adds without overwriting, edits, deletes, and current weight is the latest record', async () => {
    setToday('2026-11-01');
    const a = await createOne(); // 80 kg on 11-01
    setToday('2026-11-08');
    const jar = asProfile(a.id);
    const w1 = await call(addRoute, { jar, body: { date: '2026-11-04', weightKg: 80.6, note: 'mañana' } });
    expect(w1.status).toBe(201);
    await call(addRoute, { jar, body: { date: '2026-11-07', weightKg: 81 } });
    let list = (await call(listRoute, { jar, url: '/api/v1/weights' })).body;
    expect(list.records).toHaveLength(3);
    expect(list.latestKg).toBe(81);
    expect(list.trend).toHaveLength(3);
    expect(list.toTargetKg).toBeCloseTo(86 - list.trendKg, 9);
    expect((await call(meRoute, { jar })).body.currentWeightKg).toBe(81);

    await call(patchRoute, { method: 'PATCH', jar, params: { id: w1.body.id }, body: { weightKg: 80.4 } });
    list = (await call(listRoute, { jar, url: '/api/v1/weights' })).body;
    expect(list.records.find((r: any) => r.id === w1.body.id).weightKg).toBe(80.4);

    expect((await call(delRoute, { method: 'DELETE', jar, params: { id: w1.body.id } })).status).toBe(204);
    expect((await call(listRoute, { jar, url: '/api/v1/weights' })).body.trend).toHaveLength(0);
  });

  it('rejects future dates and deleting the last record', async () => {
    setToday('2026-11-08');
    const a = await createOne();
    expect((await call(addRoute, { jar: a.jar, body: { date: '2026-11-09', weightKg: 70 } })).status).toBe(422);
    expect((await call(addRoute, { jar: a.jar, body: { date: '2026-11-08', weightKg: 10 } })).status).toBe(422);
    const only = (await call(listRoute, { jar: a.jar, url: '/api/v1/weights' })).body.records[0];
    const r = await call(delRoute, { method: 'DELETE', jar: a.jar, params: { id: only.id } });
    expect(r.status).toBe(409);
  });

  it("refreshes today's snapshot but never past snapshots", async () => {
    setToday('2026-11-07');
    const a = await createOne();
    ensureDaySnapshot(a.id, '2026-11-07');
    setToday('2026-11-08', 9);
    const jar = asProfile(a.id);
    ensureDaySnapshot(a.id, '2026-11-08');
    await call(addRoute, { jar, body: { date: '2026-11-08', weightKg: 79 } });
    const snap = (d: string) =>
      db().select().from(dayEnergySnapshot).where(and(eq(dayEnergySnapshot.profileId, a.id), eq(dayEnergySnapshot.localDate, d))).get()!;
    expect(snap('2026-11-08').weightKg).toBe(79);
    expect(snap('2026-11-07').weightKg).toBe(80);
  });

  it('is isolated per profile and shown in the preferred unit only on the client', async () => {
    setToday('2026-11-08');
    const { a, b } = await setupTwoProfiles();
    await call(mePatch, { method: 'PATCH', jar: a.jar, body: { weightUnit: 'lb' } });
    const w = await call(addRoute, { jar: a.jar, body: { date: '2026-11-08', weightKg: 79.5 } });
    expect(w.body.weightKg).toBe(79.5);
    expect((await call(patchRoute, { method: 'PATCH', jar: b.jar, params: { id: w.body.id }, body: { weightKg: 70 } })).status).toBe(404);
    expect((await call(listRoute, { jar: b.jar, url: '/api/v1/weights' })).body.records).toHaveLength(1);
  });
});
