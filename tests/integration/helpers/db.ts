import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeEach } from 'vitest';
import { setDbHandle, type DbHandle } from '@/server/db/client';
import { prepareDatabase } from '@/server/db/setup';
import { now, setNow } from '@/server/clock';
import { resetEnvCache } from '@/server/env';
import { hashToken, randomToken } from '@/server/auth/tokens';
import { session } from '@/server/db/schema';

let handle: DbHandle | undefined;
let dir: string | undefined;

/** Fresh SQLite file per test (migrations + seeds). Call once at the top of a test file. */
export function useFreshDb(): () => DbHandle {
  beforeEach(() => {
    resetEnvCache();
    setNow(undefined);
    handle?.sqlite.close();
    dir ??= fs.mkdtempSync(path.join(os.tmpdir(), 'nutripet-'));
    const file = path.join(dir, `db-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`);
    handle = prepareDatabase(file).handle;
    setDbHandle(handle);
  });
  afterAll(() => {
    handle?.sqlite.close();
    setDbHandle(undefined);
    setNow(undefined);
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  });
  return () => handle!;
}

/** Pin "now" to a Bogotá-local date and hour (default noon). */
export function setToday(date: string, hour = 12): void {
  // Bogotá is UTC−5 all year (no DST).
  setNow(new Date(Date.parse(`${date}T00:00:00Z`) + (hour + 5) * 3_600_000));
}

export type Jar = Record<string, string>;

/** Cookie jar with a valid session for `profileId` (fakes a logged-in client). */
export function asProfile(profileId: string, jar: Jar = {}): Jar {
  const token = randomToken();
  const ts = now().toISOString();
  handle!.db.insert(session).values({ tokenHash: hashToken(token), profileId, lastSeenAt: ts, createdAt: ts }).run();
  return { ...jar, np_session: token };
}

export function anonymous(): Jar {
  return {};
}

type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

export interface CallResult<T = unknown> {
  status: number;
  body: T;
  setCookies: string[];
  jar: Jar;
}

/** Invoke a route handler like Next would. Updates and returns the cookie jar from Set-Cookie headers. */
export async function call<T = any>(
  handler: Handler,
  opts: { method?: string; url?: string; body?: unknown; jar?: Jar; params?: Record<string, string>; ip?: string } = {},
): Promise<CallResult<T>> {
  const jar = { ...(opts.jar ?? {}) };
  const headers: Record<string, string> = { 'x-forwarded-for': opts.ip ?? '127.0.0.1' };
  const cookie = Object.entries(jar)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('; ');
  if (cookie) headers.cookie = cookie;
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  const req = new Request(`http://localhost${opts.url ?? '/api/v1/test'}`, {
    method: opts.method ?? (opts.body === undefined ? 'GET' : 'POST'),
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const res = await handler(req, { params: Promise.resolve(opts.params ?? {}) });
  const setCookies = res.headers.getSetCookie();
  for (const c of setCookies) {
    const [pair] = c.split(';');
    const i = pair!.indexOf('=');
    const name = pair!.slice(0, i);
    const value = decodeURIComponent(pair!.slice(i + 1));
    if (/Max-Age=0/.test(c) || value === '') delete jar[name];
    else jar[name] = value;
  }
  const text = await res.text();
  return { status: res.status, body: (text ? JSON.parse(text) : undefined) as T, setCookies, jar };
}
