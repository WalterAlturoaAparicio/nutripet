import { z } from 'zod';
import { route } from '@/server/http/handler';
import { requireProfile } from '@/server/auth/require-profile';
import { localDate } from '@/server/validation/common';
import { progressSummary } from '@/server/modules/progress/service';

const query = z.object({ period: z.enum(['week', 'month']).default('week'), end: localDate.optional() });

export const GET = route({ query }, (ctx, { query: q }) => progressSummary(requireProfile(ctx).profileId, q.period, q.end));
