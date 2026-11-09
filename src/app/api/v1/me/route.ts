import { route } from '@/server/http/handler';
import { requireProfile } from '@/server/auth/require-profile';
import { updateProfileSchema } from '@/server/validation/profile';
import { getMe, updateMe } from '@/server/modules/profiles/service';

export const GET = route({}, (ctx) => getMe(requireProfile(ctx).profileId));

export const PATCH = route({ body: updateProfileSchema }, (ctx, { body }) => updateMe(requireProfile(ctx).profileId, body));
