import { describe, expect, it } from 'vitest';
import { call, useFreshDb } from './helpers/db';
import { setupTwoProfiles } from './helpers/fixtures';
import { GET as meGet, PATCH as mePatch } from '@/app/api/v1/me/route';
import { GET as selectorRoute } from '@/app/api/v1/profiles/selector/route';

useFreshDb();

describe('profile isolation', () => {
  it('each profile sees only its own estimates; editing A leaves B unchanged', async () => {
    const { a, b } = await setupTwoProfiles();
    const meA = await call(meGet, { jar: a.jar });
    const meB0 = await call(meGet, { jar: b.jar });
    expect(meA.body.profile.name).toBe('Ana');
    expect(meB0.body.profile.name).toBe('Bruno');
    expect(meA.body.energy.recommendedTargetKcal).not.toBe(meB0.body.energy.recommendedTargetKcal);
    expect(meA.body.energy.isEstimate).toBe(true);

    const patched = await call(mePatch, {
      method: 'PATCH',
      jar: a.jar,
      body: { heightCm: 182, activityLevel: 'high', goalType: 'maintenance', name: 'Ana María' },
    });
    expect(patched.status).toBe(200);
    expect(patched.body.settings.goalType).toBe('maintenance');
    expect(patched.body.settings.calorieAdjustmentKcal).toBe(0);

    const meB1 = await call(meGet, { jar: b.jar });
    expect(meB1.body).toEqual(meB0.body);
  });

  it('selector exposes only id, name and pet fields', async () => {
    const { a, b, deviceJar } = await setupTwoProfiles();
    const list = await call(selectorRoute, { jar: deviceJar });
    expect(list.body).toEqual([
      { id: a.id, name: 'Ana', petStage: 'newborn', petName: 'Michi' },
      { id: b.id, name: 'Bruno', petStage: 'newborn', petName: 'Michi' },
    ]);
  });

  it('validates the adjustment sign against the goal', async () => {
    const { a } = await setupTwoProfiles();
    const bad = await call(mePatch, { method: 'PATCH', jar: a.jar, body: { calorieAdjustmentKcal: -200 } });
    expect(bad.status).toBe(422);
    expect(bad.body.error.fields.calorieAdjustmentKcal).toBeTruthy();
  });

  it('asks for confirmation for targets below the safety threshold', async () => {
    const { b } = await setupTwoProfiles();
    const r = await call(mePatch, { method: 'PATCH', jar: b.jar, body: { calorieTargetOverrideKcal: 1000 } });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('CONFIRM_REQUIRED');
    expect(r.body.error.reason).toBe('target_below_safety');
    const ok = await call(mePatch, { method: 'PATCH', jar: b.jar, body: { calorieTargetOverrideKcal: 1000, confirm: true } });
    expect(ok.status).toBe(200);
    expect(ok.body.energy.activeTargetKcal).toBe(1000);
    expect(ok.body.energy.targetIsOverride).toBe(true);
  });

  it('rejects duplicate names and unknown fields', async () => {
    const { a } = await setupTwoProfiles();
    expect((await call(mePatch, { method: 'PATCH', jar: a.jar, body: { name: 'bruno' } })).status).toBe(422);
    expect((await call(mePatch, { method: 'PATCH', jar: a.jar, body: { profileId: 'x' } })).status).toBe(422);
  });
});
