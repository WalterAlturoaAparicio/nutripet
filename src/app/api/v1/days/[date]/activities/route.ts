import { parseOrThrow, reply, route } from '@/server/http/handler';
import { requireProfile } from '@/server/auth/require-profile';
import { createActivitySchema } from '@/server/validation/activity';
import { dateParam } from '@/server/validation/journal';
import { addActivity } from '@/server/modules/activity/service';

export const POST = route({ body: createActivitySchema }, (ctx, { body, params }) =>
  reply(addActivity(requireProfile(ctx).profileId, parseOrThrow(dateParam, params.date), body), 201),
);
