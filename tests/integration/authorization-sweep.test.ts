import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { call, setToday, useFreshDb } from './helpers/db';
import { profileB, setupTwoProfiles } from './helpers/fixtures';
import { seedFoods } from './helpers/foods';
import { resetRateLimits } from '@/server/auth/rate-limit';

useFreshDb();
beforeEach(() => resetRateLimits());

const API_DIR = path.resolve('src/app/api/v1');
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

/** Routes that are public or device-only by design (FR-008). */
const PUBLIC = new Set([
  'GET /setup/status',
  'POST /devices/enroll',
  'POST /profiles',
  'GET /profiles/selector',
  'POST /session',
  'DELETE /session',
  'POST /profiles/[id]/pin-reset',
]);

function routeFiles(dir = API_DIR): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? routeFiles(p) : e.name === 'route.ts' ? [p] : [];
  });
}

async function handlers() {
  const out: { key: string; route: string; method: string; fn: any }[] = [];
  for (const file of routeFiles()) {
    const route = '/' + path.relative(API_DIR, path.dirname(file)).split(path.sep).join('/');
    const mod = await import(file);
    for (const m of METHODS) if (mod[m]) out.push({ key: `${m} ${route === '/' ? '' : route}`, route, method: m, fn: mod[m] });
  }
  return out;
}

const dummyParams = { id: 'x', date: '2026-11-08', mealId: 'x' };

describe('authorization sweep (SC-005)', () => {
  it('every non-public route answers 401 without a session, before reading any input', async () => {
    const all = await handlers();
    expect(all.length).toBeGreaterThan(35);
    for (const h of all) {
      if (PUBLIC.has(h.key)) continue;
      const r = await call(h.fn, { method: h.method, params: dummyParams, url: `/api/v1${h.route}?month=2026-11`, body: h.method === 'GET' ? undefined : {} });
      expect(r.status, h.key).toBe(401);
      expect(r.body.error.code, h.key).toBe('UNAUTHENTICATED');
    }
  });

  it("profile B gets 404 for every route that takes one of A's record ids", async () => {
    setToday('2026-11-08');
    const ids = seedFoods();
    const { a, b } = await setupTwoProfiles();
    const { POST: addEntry } = await import('@/app/api/v1/days/[date]/entries/route');
    const { POST: addAct } = await import('@/app/api/v1/days/[date]/activities/route');
    const { POST: addWeight } = await import('@/app/api/v1/weights/route');
    const { POST: addTemplate } = await import('@/app/api/v1/templates/route');
    const { POST: addFood } = await import('@/app/api/v1/foods/route');
    const entry = (await call(addEntry, { jar: a.jar, params: { date: '2026-11-08' }, body: { occasion: 'lunch', foodId: ids.egg, quantity: 50, unit: 'g' } })).body;
    const act = (await call(addAct, { jar: a.jar, params: { date: '2026-11-08' }, body: { activityTypeId: 'builtin:walking', durationMin: 10, estimateMethod: 'none' } })).body;
    const weight = (await call(addWeight, { jar: a.jar, body: { date: '2026-11-08', weightKg: 79 } })).body;
    const tpl = (await call(addTemplate, { jar: a.jar, body: { name: 'T', fromMealId: entry.entry.mealId } })).body;
    const food = (
      await call(addFood, {
        jar: a.jar,
        body: { nameEs: 'Privado', category: 'otros', preparationState: 'prepared', basis: 'g', kcal: 100, proteinG: 1, carbsG: 1, fatG: 1, sourceNote: 'x' },
      })
    ).body;

    const byRoute: Record<string, Record<string, string>> = {
      '/entries/[id]': { id: entry.entry.id },
      '/activities/[id]': { id: act.activity.id },
      '/weights/[id]': { id: weight.id },
      '/meals/[mealId]/duplicate': { mealId: entry.entry.mealId },
      '/templates/[id]': { id: tpl.id },
      '/templates/[id]/apply': { id: tpl.id },
      '/foods/[id]': { id: food.id },
      '/foods/[id]/override': { id: food.id },
      '/foods/[id]/favorite': { id: food.id },
      '/foods/[id]/variants': { id: food.id },
    };
    const validBodies: Record<string, unknown> = {
      'PATCH /entries/[id]': { quantity: 10 },
      'PATCH /activities/[id]': { durationMin: 5 },
      'PATCH /weights/[id]': { weightKg: 70 },
      'POST /meals/[mealId]/duplicate': { toDate: '2026-11-08', toOccasion: 'dinner' },
      'POST /templates/[id]/apply': { date: '2026-11-08', occasion: 'dinner' },
      'PATCH /foods/[id]': { nameEs: 'Robado' },
      'POST /foods/[id]/override': { basis: 'g', kcal: 1, proteinG: 0, carbsG: 0, fatG: 0 },
    };
    const all = await handlers();
    let checked = 0;
    for (const h of all) {
      const params = byRoute[h.route];
      if (!params) continue;
      const r = await call(h.fn, { method: h.method, jar: b.jar, params, body: validBodies[h.key] ?? (h.method === 'GET' || h.method === 'DELETE' || h.method === 'PUT' ? undefined : {}) });
      expect(r.status, h.key).toBe(404);
      expect(JSON.stringify(r.body ?? '')).not.toContain('Privado');
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(15);
  });

  it('unauthorized profile creation and profile discovery are refused', async () => {
    const { a } = await setupTwoProfiles();
    const { POST: createRoute } = await import('@/app/api/v1/profiles/route');
    const { GET: selector } = await import('@/app/api/v1/profiles/selector/route');
    const { POST: session } = await import('@/app/api/v1/session/route');
    const { POST: pinReset } = await import('@/app/api/v1/profiles/[id]/pin-reset/route');
    const { GET: status } = await import('@/app/api/v1/setup/status/route');

    expect((await call(createRoute, { body: { ...profileB, name: 'Intruso' } })).status).toBe(403);
    for (let i = 0; i < 5; i++) await call(createRoute, { body: { ...profileB, name: 'Intruso', setupToken: 'y'.repeat(40) }, ip: '10.9.9.9' });
    expect((await call(createRoute, { body: { ...profileB, name: 'Intruso', setupToken: 'y'.repeat(40) }, ip: '10.9.9.9' })).status).toBe(429);

    for (const [fn, opts] of [
      [selector, {}],
      [session, { body: { profileId: a.id, pin: '1234' } }],
      [pinReset, { body: { recoveryCode: a.recoveryCode, newPin: '9999' }, params: { id: a.id } }],
    ] as const) {
      const r = await call(fn as any, opts as any);
      expect(r.status).toBe(401);
      expect(r.body.error.code).toBe('DEVICE_NOT_ENROLLED');
      expect(JSON.stringify(r.body)).not.toMatch(/Ana|Bruno/);
    }
    const s = await call(status);
    expect(Object.keys(s.body).sort()).toEqual(['deviceEnrolled', 'needsInitialSetup']);
  });
});
