import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { call, useFreshDb } from './helpers/db';
import { reply, route } from '@/server/http/handler';
import { ApiError } from '@/server/http/errors';
import '@/server/auth/cookies';

const getDb = useFreshDb();

describe('foundation', () => {
  it('applies migrations', () => {
    const tables = getDb()
      .sqlite.prepare("select name from sqlite_master where type='table'")
      .all()
      .map((r: any) => r.name);
    expect(tables).toEqual(expect.arrayContaining(['profile', 'session', 'weight_record']));
  });

  it('validates bodies and maps errors', async () => {
    const h = route({ body: z.object({ n: z.number().int() }) }, (_ctx, { body }) => {
      if (body.n < 0) throw new ApiError('CONFLICT');
      return reply({ doubled: body.n * 2 }, 201);
    });
    expect((await call(h, { body: { n: 2 } })).body).toEqual({ doubled: 4 });
    const bad = await call(h, { body: { n: 'x' } });
    expect(bad.status).toBe(422);
    expect(bad.body.error.fields.n).toBeTruthy();
    expect((await call(h, { body: { n: -1 } })).status).toBe(409);
  });

  it('sets HttpOnly SameSite=Strict cookies without Secure in dev', async () => {
    const h = route({}, (ctx) => {
      ctx.setCookie('np_test', 'v');
      return { ok: true };
    });
    const res = await call(h);
    expect(res.setCookies[0]).toMatch(/HttpOnly/);
    expect(res.setCookies[0]).toMatch(/SameSite=Strict/);
    expect(res.setCookies[0]).not.toMatch(/Secure/);
  });
});
