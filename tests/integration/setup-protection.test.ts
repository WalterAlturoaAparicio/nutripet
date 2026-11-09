import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { call, setToday, useFreshDb } from './helpers/db';
import { createOne, profileB } from './helpers/fixtures';
import { POST as createRoute } from '@/app/api/v1/profiles/route';
import { GET as selectorRoute } from '@/app/api/v1/profiles/selector/route';
import { POST as sessionRoute } from '@/app/api/v1/session/route';
import { GET as statusRoute } from '@/app/api/v1/setup/status/route';
import { POST as enrollRoute } from '@/app/api/v1/devices/enroll/route';
import { POST as pairingRoute } from '@/app/api/v1/devices/pairing-code/route';
import { GET as devicesRoute } from '@/app/api/v1/devices/route';
import { DELETE as revokeRoute } from '@/app/api/v1/devices/[id]/route';
import { resetRateLimits } from '@/server/auth/rate-limit';
import { setNow } from '@/server/clock';

useFreshDb();
beforeEach(() => resetRateLimits());

const TOKEN = process.env.SETUP_TOKEN!;

describe('initial setup', () => {
  it('allows anonymous creation only while no profiles exist, and enrolls the device', async () => {
    const status0 = await call(statusRoute);
    expect(status0.body).toEqual({ needsInitialSetup: true, deviceEnrolled: false });
    const a = await createOne();
    expect(a.jar.np_device).toBeTruthy();
    const status1 = await call(statusRoute, { jar: { np_device: a.jar.np_device! } });
    expect(status1.body).toEqual({ needsInitialSetup: false, deviceEnrolled: true });
    expect(Object.keys(status1.body)).toHaveLength(2);
  });
});

describe('protected creation', () => {
  it('rejects anonymous and wrong-token creation, rate limits, accepts token or session', async () => {
    const a = await createOne();
    expect((await call(createRoute, { body: profileB })).status).toBe(403);
    for (let i = 0; i < 4; i++) {
      expect((await call(createRoute, { body: { ...profileB, setupToken: 'x'.repeat(40) }, ip: '10.0.0.9' })).status).toBe(403);
    }
    const fifth = await call(createRoute, { body: { ...profileB, setupToken: 'x'.repeat(40) }, ip: '10.0.0.9' });
    expect(fifth.status).toBe(403);
    const blocked = await call(createRoute, { body: { ...profileB, setupToken: TOKEN }, ip: '10.0.0.9' });
    expect(blocked.status).toBe(429);

    const viaToken = await call(createRoute, { body: { ...profileB, setupToken: TOKEN }, ip: '10.0.0.10' });
    expect(viaToken.status).toBe(201);
    expect(viaToken.jar.np_device).toBeTruthy();
    const viaSession = await call(createRoute, { body: { ...profileB, name: 'Carla' }, jar: a.jar });
    expect(viaSession.status).toBe(201);
  });
});

describe('profile discovery', () => {
  it('requires an enrolled device for the selector and login', async () => {
    const a = await createOne();
    const noDevice = await call(selectorRoute);
    expect(noDevice.status).toBe(401);
    expect(noDevice.body.error.code).toBe('DEVICE_NOT_ENROLLED');
    expect(JSON.stringify(noDevice.body)).not.toContain('Ana');
    const login = await call(sessionRoute, { body: { profileId: a.id, pin: '1234' } });
    expect(login.body.error.code).toBe('DEVICE_NOT_ENROLLED');
    const ok = await call(selectorRoute, { jar: { np_device: a.jar.np_device! } });
    expect(ok.body).toEqual([{ id: a.id, name: 'Ana', petStage: 'newborn', petName: 'Michi' }]);
  });

  it('enrolls a new device with a single-use pairing code valid 10 minutes', async () => {
    setToday('2026-11-08', 9);
    const a = await createOne();
    const code = await call(pairingRoute, { method: 'POST', jar: a.jar });
    expect(code.status).toBe(201);
    const enrolled = await call(enrollRoute, { body: { label: 'Teléfono 2', pairingCode: code.body.code.toLowerCase() } });
    expect(enrolled.status).toBe(204);
    expect(enrolled.jar.np_device).toBeTruthy();
    expect((await call(enrollRoute, { body: { label: 'Otro', pairingCode: code.body.code } })).status).toBe(403);

    const late = await call(pairingRoute, { method: 'POST', jar: a.jar });
    setNow(new Date(Date.parse('2026-11-08T14:11:00Z')));
    expect((await call(enrollRoute, { body: { label: 'Tarde', pairingCode: late.body.code } })).status).toBe(403);
  });

  it('enrolls with the setup token and rejects revoked devices', async () => {
    const a = await createOne();
    const enrolled = await call(enrollRoute, { body: { label: 'Tablet', setupToken: TOKEN } });
    expect(enrolled.status).toBe(204);
    const list = await call(devicesRoute, { jar: a.jar });
    const tablet = list.body.find((d: any) => d.label === 'Tablet');
    expect((await call(revokeRoute, { method: 'DELETE', jar: a.jar, params: { id: tablet.id } })).status).toBe(204);
    expect((await call(selectorRoute, { jar: enrolled.jar })).status).toBe(401);
  });

  it('never returns the setup token in responses', async () => {
    const a = await createOne();
    const bodies = [
      await call(statusRoute, { jar: a.jar }),
      await call(selectorRoute, { jar: a.jar }),
      await call(devicesRoute, { jar: a.jar }),
      await call(createRoute, { body: { ...profileB, setupToken: TOKEN } }),
    ];
    for (const r of bodies) expect(JSON.stringify(r.body ?? '')).not.toContain(TOKEN);
  });

  it('does not ship the setup token or its env name in client bundles', () => {
    const dir = path.resolve('.next/static');
    if (!fs.existsSync(dir)) return; // only checked after a production build
    const walk = (d: string): string[] =>
      fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
    for (const f of walk(dir).filter((f) => f.endsWith('.js'))) {
      expect(fs.readFileSync(f, 'utf8')).not.toContain('SETUP_TOKEN');
    }
  });
});
