import { route } from '@/server/http/handler';
import { parseOrThrow } from '@/server/http/handler';
import { requireProfile } from '@/server/auth/require-profile';
import { dateParam } from '@/server/validation/journal';
import { getDaySummary } from '@/server/modules/journal/service';

export const GET = route({}, (ctx, { params }) => getDaySummary(requireProfile(ctx).profileId, parseOrThrow(dateParam, params.date)));
