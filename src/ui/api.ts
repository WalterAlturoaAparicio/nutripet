'use client';

export interface ApiErrorBody {
  code: string;
  message: string;
  fields?: Record<string, string>;
  retryAfterSec?: number;
  reason?: string;
}

export class ClientApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody,
  ) {
    super(body.message);
  }
}

/** Fetch wrapper for /api/v1. Redirects to the profile selector when the session has ended. */
export async function api<T = unknown>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (data as { error?: ApiErrorBody }).error ?? { code: 'INTERNAL', message: 'Error' };
    if (err.code === 'UNAUTHENTICATED' && !url.includes('/session') && typeof window !== 'undefined') {
      window.location.replace('/select?expired=1');
    }
    throw new ClientApiError(res.status, err);
  }
  return data as T;
}
