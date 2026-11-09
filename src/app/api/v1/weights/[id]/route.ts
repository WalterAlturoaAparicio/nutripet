import { noContent, route } from '@/server/http/handler';
import { requireProfile } from '@/server/auth/require-profile';
import { updateWeightSchema } from '@/server/validation/weight';
import { deleteWeight, updateWeight } from '@/server/modules/weight/service';

export const PATCH = route({ body: updateWeightSchema }, (ctx, { body, params }) => updateWeight(requireProfile(ctx).profileId, params.id!, body));

export const DELETE = route({}, (ctx, { params }) => {
  deleteWeight(requireProfile(ctx).profileId, params.id!);
  return noContent();
});
