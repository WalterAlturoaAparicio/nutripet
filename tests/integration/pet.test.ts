import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { asProfile, call, setToday, useFreshDb } from './helpers/db';
import { createOne, profileA, setupTwoProfiles } from './helpers/fixtures';
import { seedFoods } from './helpers/foods';
import { addDays } from '@/domain/dates';
import { POST as addEntryRoute } from '@/app/api/v1/days/[date]/entries/route';
import { POST as addActivityRoute } from '@/app/api/v1/days/[date]/activities/route';
import { DELETE as deleteEntryRoute } from '@/app/api/v1/entries/[id]/route';
import { POST as createRoute } from '@/app/api/v1/profiles/route';
import { GET as petRoute, PATCH as petPatch } from '@/app/api/v1/pet/route';
import { POST as feedRoute } from '@/app/api/v1/pet/feed/route';
import { POST as weightRoute } from '@/app/api/v1/weights/route';
import { db } from '@/server/db/client';
import { pet } from '@/server/db/schema';
import { MIGRATIONS_FOLDER } from '@/server/db/client';
import fs from 'node:fs';
import path from 'node:path';

const getDb = useFreshDb();

type Jar = Record<string, string>;
const add = (jar: Jar, date: string, occasion: string, foodId: string) =>
  call(addEntryRoute, { jar, params: { date }, body: { occasion, foodId, quantity: 50, unit: 'g' } });
const getPet = async (jar: Jar) => (await call(petRoute, { jar })).body;

describe('virtual cat', () => {
  it('is created with the profile (custom name) and the selector shows it', async () => {
    const r = await call(createRoute, { body: { ...profileA, petName: 'Tigre' } });
    const p = await getPet(r.jar);
    expect(p).toMatchObject({ name: 'Tigre', stage: 'newborn', xpTotal: 0, treats: 0, moodLabel: 'happy' });
    expect(p.message.key).toBe('pet.msg.gain.welcome');
  });

  it('logging awards XP visible in the day summary; caps hold; deleting revokes', async () => {
    setToday('2026-11-08');
    const ids = seedFoods();
    const a = await createOne();
    let last: any;
    const entries: string[] = [];
    for (let i = 0; i < 12; i++) {
      const r = await call(addEntryRoute, { jar: a.jar, params: { date: '2026-11-08' }, body: { occasion: 'extra', label: `x${i}`, foodId: ids.egg, quantity: 10, unit: 'g' } });
      entries.push(r.body.entry.id);
      last = r;
    }
    const xp = last.body.day.xpAwarded;
    expect(xp.find((x: any) => x.source === 'food_entry').amount).toBe(20);
    expect(last.body.day.status).toBe('food_completed');
    expect(xp.find((x: any) => x.source === 'food_day').amount).toBe(15);
    let p = await getPet(a.jar);
    expect(p.treats).toBe(1);
    const totalBefore = p.xpTotal;

    // Add/delete cycles cannot exceed the cap.
    for (let i = 0; i < 5; i++) {
      const r = await call(addEntryRoute, { jar: a.jar, params: { date: '2026-11-08' }, body: { occasion: 'extra', label: 'ciclo', foodId: ids.egg, quantity: 10, unit: 'g' } });
      await call(deleteEntryRoute, { method: 'DELETE', jar: a.jar, params: { id: r.body.entry.id } });
    }
    p = await getPet(a.jar);
    expect(p.xpTotal).toBe(totalBefore);
    expect(p.stage).toBe('newborn');
  });

  it('a day leaving completed revokes food_day, activity bonus and the unspent treat; stage never drops', async () => {
    setToday('2026-11-08');
    const ids = seedFoods();
    const a = await createOne();
    const e1 = (await add(a.jar, '2026-11-08', 'breakfast', ids.egg!)).body.entry.id;
    await add(a.jar, '2026-11-08', 'lunch', ids.egg!);
    await add(a.jar, '2026-11-08', 'dinner', ids.egg!);
    const act = await call(addActivityRoute, { jar: a.jar, params: { date: '2026-11-08' }, body: { activityTypeId: 'builtin:walking', durationMin: 30, estimateMethod: 'none' } });
    expect(act.body.day.xpAwarded.find((x: any) => x.source === 'activity_bonus').amount).toBe(1);
    let p = await getPet(a.jar);
    expect(p.treats).toBe(1);
    const maxBefore = p.maxXpReached;

    const del = await call(deleteEntryRoute, { method: 'DELETE', jar: a.jar, params: { id: e1 } });
    expect(del.body.day.status).toBe('food_partial');
    const sources = del.body.day.xpAwarded.map((x: any) => x.source);
    expect(sources).not.toContain('food_day');
    expect(sources).not.toContain('activity_bonus');
    p = await getPet(a.jar);
    expect(p.treats).toBe(0);
    expect(p.maxXpReached).toBe(maxBefore);
    expect(p.xpTotal).toBeLessThan(maxBefore);
  });

  it('a fed treat is not taken back: the balance never goes below 0', async () => {
    setToday('2026-11-08');
    const ids = seedFoods();
    const a = await createOne();
    const e1 = (await add(a.jar, '2026-11-08', 'breakfast', ids.egg!)).body.entry.id;
    await add(a.jar, '2026-11-08', 'lunch', ids.egg!);
    await add(a.jar, '2026-11-08', 'dinner', ids.egg!);
    const fed = await call(feedRoute, { jar: a.jar });
    expect(fed.status).toBe(200);
    expect(fed.body.treats).toBe(0);
    expect(fed.body.message.key).toBe('pet.msg.gain.feed');
    expect((await call(feedRoute, { jar: a.jar })).status).toBe(409);
    await call(deleteEntryRoute, { method: 'DELETE', jar: a.jar, params: { id: e1 } });
    expect((await getPet(a.jar)).treats).toBe(0);
  });

  it('activity-only days and backfill older than 2 days give no treat or XP', async () => {
    setToday('2026-11-08');
    const ids = seedFoods();
    const a = await createOne();
    await call(addActivityRoute, { jar: a.jar, params: { date: '2026-11-08' }, body: { activityTypeId: 'builtin:walking', durationMin: 30, estimateMethod: 'none' } });
    let p = await getPet(a.jar);
    expect(p.treats).toBe(0);
    expect(p.xpTotal).toBe(5);
    for (const o of ['breakfast', 'lunch', 'dinner']) await add(a.jar, '2026-11-04', o, ids.egg!);
    p = await getPet(a.jar);
    expect(p).toMatchObject({ xpTotal: 5, treats: 0 });
  });

  it("B's cat is unaffected by A; identical behavior gives identical rewards with goal-specific messages", async () => {
    setToday('2026-11-08');
    const ids = seedFoods();
    const { a, b } = await setupTwoProfiles();
    for (const o of ['breakfast', 'lunch', 'dinner']) await add(a.jar, '2026-11-08', o, ids.egg!);
    expect((await getPet(b.jar)).xpTotal).toBe(0);
    for (const o of ['breakfast', 'lunch', 'dinner']) await add(b.jar, '2026-11-08', o, ids.oats!);
    const pa = await getPet(a.jar);
    const pb = await getPet(b.jar);
    expect({ xp: pb.xpTotal, treats: pb.treats, stage: pb.stage }).toEqual({ xp: pa.xpTotal, treats: pa.treats, stage: pa.stage });
    expect(pa.message.key).toBe('pet.msg.gain.food_day_completed');
    expect(pb.message.key).toBe('pet.msg.loss.food_day_completed');
  });

  it('weight XP at most once every 3 days', async () => {
    setToday('2026-11-08');
    const a = await createOne();
    await call(weightRoute, { jar: a.jar, body: { date: '2026-11-08', weightKg: 80 } });
    await call(weightRoute, { jar: a.jar, body: { date: '2026-11-07', weightKg: 80.2 } });
    expect((await getPet(a.jar)).xpTotal).toBe(10);
  });

  it('a 7-day streak unlocks a milestone with an accessory that can be equipped; mood decays mildly', async () => {
    setToday('2026-11-01');
    const ids = seedFoods();
    const a = await createOne();
    for (let i = 0; i < 7; i++) {
      const date = addDays('2026-11-01', i);
      setToday(date, 20);
      const jar = asProfile(a.id);
      for (const o of ['breakfast', 'lunch', 'dinner']) await add(jar, date, o, ids.egg!);
    }
    let jar = asProfile(a.id);
    let p = await getPet(jar);
    expect(p.recentMilestones.map((m: any) => m.id)).toEqual(expect.arrayContaining(['streak_7', 'first_full_week']));
    expect(p.accessories.find((x: any) => x.id === 'gorro').unlocked).toBe(true);
    expect((await call(petPatch, { method: 'PATCH', jar, body: { equippedAccessoryIds: ['corona'] } })).status).toBe(422);
    p = (await call(petPatch, { method: 'PATCH', jar, body: { equippedAccessoryIds: ['gorro'], name: 'Luna' } })).body;
    expect(p).toMatchObject({ name: 'Luna' });
    expect(p.accessories.find((x: any) => x.id === 'gorro').equipped).toBe(true);
    const xp = p.xpTotal;
    const stage = p.stage;

    setToday('2026-11-13', 12); // 5 days later, nothing logged in between
    jar = asProfile(a.id);
    p = await getPet(jar);
    expect(p.mood).toBeGreaterThanOrEqual(30);
    expect(p.moodLabel).not.toBe('happy');
    expect(p.xpTotal).toBe(xp);
    expect(p.stage).toBe(stage);
    expect(p.message.key).toBe('pet.msg.gain.missed_you');
  });

  it('a data migration gives pets to profiles that existed before US7', () => {
    const file = fs.readdirSync(MIGRATIONS_FOLDER).find((f) => f.endsWith('_pet_backfill.sql'))!;
    const sql = fs.readFileSync(path.join(MIGRATIONS_FOLDER, file), 'utf8');
    const h = getDb();
    h.sqlite.prepare(`INSERT INTO profile (id, name, target_weight_kg, pin_hash, recovery_code_hash, created_at, updated_at) VALUES ('old', 'Old', 70, 'x', 'y', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`).run();
    h.sqlite.exec(sql.replace(/--> statement-breakpoint/g, ''));
    expect(db().select().from(pet).where(eq(pet.profileId, 'old')).get()).toMatchObject({ name: 'Michi', stage: 'newborn' });
  });
});
