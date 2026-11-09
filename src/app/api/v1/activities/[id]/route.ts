import { route } from '@/server/http/handler';
import { requireProfile } from '@/server/auth/require-profile';
import { updateActivitySchema } from '@/server/validation/activity';
import { deleteActivity, updateActivity } from '@/server/modules/activity/service';

export const PATCH = route({ body: updateActivitySchema }, (ctx, { body, params }) => updateActivity(requireProfile(ctx).profileId, params.id!, body));

export const DELETE = route({}, (ctx, { params }) => deleteActivity(requireProfile(ctx).profileId, params.id!));
