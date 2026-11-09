import { beforeEach, describe, expect, it } from 'vitest';
import { call, setToday, useFreshDb } from './helpers/db';
import { createOne, loginAs, profileA } from './helpers/fixtures';
import { GET as meRoute } from '@/app/api/v1/me/route';
import { POST as pinResetRoute } from '@/app/api/v1/profiles/[id]/pin-reset/route';
import { POST as createRoute } from '@/app/api/v1/profiles/route';
import { setNow } from '@/server/clock';
import { resetRateLimits } from '@/server/auth/rate-limit';
import { resetEnvCache } from '@/server/env';

useFreshDb();
beforeEach(() => resetRateLimits());

function advance(ms: number) {
  setNow(new Date(Date.now() + ms));
}

describe('profile creation and login', () => {
  it('returns a recovery code once and logs in the new profile', async () => {
    const a = await createOne();
    expect(a.recoveryCode).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(a.jar.np_session).toBeTruthy();
    const me = await call(meRoute, { jar: a.jar });
    expect(me.status).toBe(200);
    expect(me.body.profile.name).toBe('Ana');
    expect(JSON.stringify(me.body)).not.toContain(a.recoveryCode);
  });

  it('a correct PIN creates a session', async () => {
    const a = await createOne();
    const res = await loginAs({ np_device: a.jar.np_device! }, a.id, '1234');
    expect(res.status).toBe(204);
    expect(res.jar.np_session).toBeTruthy();
  });
});

describe('PIN lockout', () => {
  it('locks after 5 failures for 60 s, then doubles, capped at 15 min', async () => {
    const a = await createOne();
    const device = { np_device: a.jar.np_device! };
    for (let i = 0; i < 4; i++) expect((await loginAs(device, a.id, '0000')).status).toBe(401);
    const fifth = await loginAs(device, a.id, '0000');
    expect(fifth.status).toBe(423);
    expect(fifth.body.error.retryAfterSec).toBe(60);
    // Even the correct PIN is refused while locked.
    expect((await loginAs(device, a.id, '1234')).status).toBe(423);

    const expected = [120, 240, 480, 900, 900];
    let t = Date.now();
    for (const sec of expected) {
      t += 16 * 60_000;
      setNow(new Date(t));
      for (let i = 0; i < 4; i++) await loginAs(device, a.id, '0000');
      const r = await loginAs(device, a.id, '0000');
      expect(r.status).toBe(423);
      expect(r.body.error.retryAfterSec).toBe(sec);
    }
    t += 16 * 60_000;
    setNow(new Date(t));
    expect((await loginAs(device, a.id, '1234')).status).toBe(204);
  });
});

describe('recovery', () => {
  it('locks recovery after 5 wrong codes with its own counter', async () => {
    const a = await createOne();
    const device = { np_device: a.jar.np_device! };
    const attempt = (code: string) =>
      call(pinResetRoute, { body: { recoveryCode: code, newPin: '4321' }, jar: device, params: { id: a.id } });
    for (let i = 0; i < 4; i++) expect((await attempt('AAAA-BBBB-CCCC')).status).toBe(422);
    const fifth = await attempt('AAAA-BBBB-CCCC');
    expect(fifth.status).toBe(423);
    expect(fifth.body.error.retryAfterSec).toBe(60);
    // PIN login is independent of the recovery lock.
    expect((await loginAs(device, a.id, '1234')).status).toBe(204);
    // Correct code is refused while locked.
    expect((await attempt(a.recoveryCode)).status).toBe(423);
  });

  it('a successful reset rotates the code and resets both counters', async () => {
    const a = await createOne();
    const device = { np_device: a.jar.np_device! };
    for (let i = 0; i < 3; i++) await loginAs(device, a.id, '0000');
    for (let i = 0; i < 3; i++)
      await call(pinResetRoute, { body: { recoveryCode: 'WRONG-CODE-XX', newPin: '4321' }, jar: device, params: { id: a.id } });
    const ok = await call(pinResetRoute, {
      body: { recoveryCode: a.recoveryCode.toLowerCase().replace(/-/g, ' '), newPin: '4321' },
      jar: device,
      params: { id: a.id },
    });
    expect(ok.status).toBe(200);
    expect(ok.body.recoveryCode).not.toBe(a.recoveryCode);
    // Old sessions are revoked; old PIN fails, new PIN works.
    expect((await call(meRoute, { jar: a.jar })).status).toBe(401);
    expect((await loginAs(device, a.id, '1234')).status).toBe(401);
    expect((await loginAs(device, a.id, '4321')).status).toBe(204);
    // Counters were reset: 4 more failures do not lock.
    for (let i = 0; i < 4; i++) expect((await loginAs(device, a.id, '0000')).status).toBe(401);
    // The old recovery code no longer works, the new one does.
    const reuse = await call(pinResetRoute, { body: { recoveryCode: a.recoveryCode, newPin: '1111' }, jar: device, params: { id: a.id } });
    expect(reuse.status).toBe(422);
  });
});

describe('sessions', () => {
  it('expires after 15 minutes of inactivity', async () => {
    setToday('2026-11-08', 10);
    const a = await createOne();
    advance(0);
    setNow(new Date(Date.parse('2026-11-08T15:14:00Z')));
    expect((await call(meRoute, { jar: a.jar })).status).toBe(200);
    setNow(new Date(Date.parse('2026-11-08T15:30:00Z')));
    expect((await call(meRoute, { jar: a.jar })).status).toBe(401);
  });

  it('cookies are HttpOnly and SameSite=Strict; Secure follows COOKIE_SECURE', async () => {
    const dev = await call(createRoute, { body: profileA });
    for (const c of dev.setCookies) {
      expect(c).toMatch(/HttpOnly/);
      expect(c).toMatch(/SameSite=Strict/);
      expect(c).not.toMatch(/Secure/);
    }
    process.env.COOKIE_SECURE = 'true';
    resetEnvCache();
    try {
      const prod = await call(createRoute, { body: { ...profileA, name: 'Otra' }, jar: dev.jar });
      expect(prod.status).toBe(201);
      expect(prod.setCookies.some((c) => /;\s*Secure/.test(c))).toBe(true);
    } finally {
      process.env.COOKIE_SECURE = 'false';
      resetEnvCache();
    }
  });
});
