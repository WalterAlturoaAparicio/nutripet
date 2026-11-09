import { route } from '@/server/http/handler';
import { requireProfile } from '@/server/auth/require-profile';
import { streakSummary } from '@/server/modules/calendar/service';

export const GET = route({}, (ctx) => streakSummary(requireProfile(ctx).profileId));
