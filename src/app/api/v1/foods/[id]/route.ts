import { noContent, route } from '@/server/http/handler';
import { requireProfile } from '@/server/auth/require-profile';
import { getFood } from '@/server/modules/foods/service';
import { hideCustomFood, updateCustomFood } from '@/server/modules/foods/custom';
import { updateCustomFoodSchema } from '@/server/validation/foods';

export const GET = route({}, (ctx, { params }) => getFood(requireProfile(ctx).profileId, params.id!));

// Own custom foods only (others → 404).
export const PATCH = route({ body: updateCustomFoodSchema }, (ctx, { body, params }) =>
  updateCustomFood(requireProfile(ctx).profileId, params.id!, body),
);

export const DELETE = route({}, (ctx, { params }) => {
  hideCustomFood(requireProfile(ctx).profileId, params.id!);
  return noContent();
});
