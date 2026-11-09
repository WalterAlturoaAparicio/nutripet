import { env } from '../env';
import { setCookieSerializer, type CookieOptions } from '../http/handler';

/** Cookie flags shared by np_session and np_device: always HttpOnly + SameSite=Strict; Secure per COOKIE_SECURE. */
export function serializeCookie(name: string, value: string, opts: CookieOptions = {}): string {
  const parts = [`${name}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Strict'];
  if (env().cookieSecure) parts.push('Secure');
  if (opts.maxAgeSec !== undefined) parts.push(`Max-Age=${opts.maxAgeSec}`);
  if (opts.expires) parts.push(`Expires=${opts.expires.toUTCString()}`);
  return parts.join('; ');
}

setCookieSerializer(serializeCookie);
