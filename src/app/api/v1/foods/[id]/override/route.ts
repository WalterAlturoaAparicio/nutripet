import { route } from '@/server/http/handler';
import { requireProfile } from '@/server/auth/require-profile';
import { removeOverride, setOverride } from '@/server/modules/foods/custom';
import { overrideSchema } from '@/server/validation/foods';

export const POST = route({ body: overrideSchema }, (ctx, { body, params }) => setOverride(requireProfile(ctx).profileId, params.id!, body));

export const DELETE = route({}, (ctx, { params }) => removeOverride(requireProfile(ctx).profileId, params.id!));
