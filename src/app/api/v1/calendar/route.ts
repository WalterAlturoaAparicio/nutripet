import { z } from 'zod';
import { route } from '@/server/http/handler';
import { requireProfile } from '@/server/auth/require-profile';
import { getCalendar } from '@/server/modules/calendar/service';

const query = z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mes inválido (AAAA-MM).') });

export const GET = route({ query }, (ctx, { query: q }) => getCalendar(requireProfile(ctx).profileId, q.month));
