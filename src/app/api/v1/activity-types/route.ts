import { reply, route } from '@/server/http/handler';
import { requireProfile } from '@/server/auth/require-profile';
import { createActivityTypeSchema } from '@/server/validation/activity';
import { createActivityType, listActivityTypes } from '@/server/modules/activity/service';

export const GET = route({}, (ctx) => listActivityTypes(requireProfile(ctx).profileId));

export const POST = route({ body: createActivityTypeSchema }, (ctx, { body }) =>
  reply(createActivityType(requireProfile(ctx).profileId, body), 201),
);
