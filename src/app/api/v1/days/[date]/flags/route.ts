import { parseOrThrow, route } from '@/server/http/handler';
import { requireProfile } from '@/server/auth/require-profile';
import { dateParam, dayFlagsSchema } from '@/server/validation/journal';
import { setDayFlags } from '@/server/modules/calendar/service';
import { getDaySummary } from '@/server/modules/journal/service';

export const PUT = route({ body: dayFlagsSchema }, (ctx, { body, params }) => {
  const { profileId } = requireProfile(ctx);
  const date = parseOrThrow(dateParam, params.date);
  setDayFlags(profileId, date, body);
  return { day: getDaySummary(profileId, date) };
});
