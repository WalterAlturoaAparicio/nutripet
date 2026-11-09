import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { ApiError, toResponse } from './errors';
import { now } from '../clock';

export interface CookieOptions {
  maxAgeSec?: number;
  expires?: Date;
}

/** Per-request context. Handlers never touch `next/headers`, so they are testable with plain Requests. */
export interface Ctx {
  req: Request;
  ip: string;
  now: Date;
  getCookie(name: string): string | undefined;
  setCookie(name: string, value: string, opts?: CookieOptions): void;
  clearCookie(name: string): void;
}

export interface Reply {
  __reply: true;
  status: number;
  body?: unknown;
}

export const reply = (body: unknown, status = 200): Reply => ({ __reply: true, status, body });
export const noContent = (): Reply => ({ __reply: true, status: 204 });

type Params = Record<string, string>;

interface RouteSpec<B extends z.ZodType | undefined, Q extends z.ZodType | undefined> {
  body?: B;
  query?: Q;
  /** Public or device-only routes. All others require a valid session BEFORE any input is parsed. */
  public?: boolean;
}

let sessionChecker: ((ctx: Ctx) => boolean) | null = null;

/** Installed by the auth layer; lets route() authenticate before validating input. */
export function setSessionChecker(fn: (ctx: Ctx) => boolean): void {
  sessionChecker = fn;
}

type Infer<T> = T extends z.ZodType ? z.infer<T> : undefined;

export type CookieWriter = (name: string, value: string, maxAgeSec: number | undefined) => string;

let cookieSerializer: (name: string, value: string, opts: CookieOptions & { clear?: boolean }) => string = (
  name,
  value,
) => `${name}=${value}; Path=/; HttpOnly; SameSite=Strict`;

/** Installed by the auth layer so cookie flags (Secure etc.) live in one place. */
export function setCookieSerializer(fn: typeof cookieSerializer): void {
  cookieSerializer = fn;
}

function parseCookies(header: string | null): Map<string, string> {
  const map = new Map<string, string>();
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) map.set(part.slice(0, i).trim(), decodeURIComponent(part.slice(i + 1).trim()));
  }
  return map;
}

function zodFields(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

export function parseOrThrow<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) throw new ApiError('VALIDATION', undefined, { fields: zodFields(result.error) });
  return result.data;
}

export function route<B extends z.ZodType | undefined = undefined, Q extends z.ZodType | undefined = undefined>(
  spec: RouteSpec<B, Q>,
  fn: (ctx: Ctx, input: { body: Infer<B>; query: Infer<Q>; params: Params }) => Promise<unknown> | unknown,
) {
  return async (req: NextRequest | Request, context: { params: Promise<Params> }): Promise<Response> => {
    const setCookies: string[] = [];
    const cookies = parseCookies(req.headers.get('cookie'));
    const ctx: Ctx = {
      req,
      ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'local',
      now: now(),
      getCookie: (name) => cookies.get(name),
      setCookie: (name, value, opts = {}) => setCookies.push(cookieSerializer(name, encodeURIComponent(value), opts)),
      clearCookie: (name) => setCookies.push(cookieSerializer(name, '', { maxAgeSec: 0, clear: true })),
    };
    let response: Response;
    try {
      if (!spec.public && sessionChecker && !sessionChecker(ctx)) throw new ApiError('UNAUTHENTICATED');
      const params = (await context?.params) ?? {};
      let body: unknown = undefined;
      if (spec.body) {
        let raw: unknown = {};
        const text = await req.text();
        if (text) {
          try {
            raw = JSON.parse(text);
          } catch {
            throw new ApiError('VALIDATION', 'El cuerpo de la solicitud no es JSON válido.');
          }
        }
        body = parseOrThrow(spec.body, raw);
      }
      let query: unknown = undefined;
      if (spec.query) {
        query = parseOrThrow(spec.query, Object.fromEntries(new URL(req.url).searchParams));
      }
      const result = await fn(ctx, { body: body as Infer<B>, query: query as Infer<Q>, params });
      if (result && typeof result === 'object' && '__reply' in result) {
        const r = result as Reply;
        response = r.status === 204 ? new Response(null, { status: 204 }) : Response.json(r.body ?? null, { status: r.status });
      } else if (result === undefined) {
        response = new Response(null, { status: 204 });
      } else {
        response = Response.json(result);
      }
    } catch (err) {
      response = toResponse(err);
    }
    for (const c of setCookies) response.headers.append('Set-Cookie', c);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  };
}
