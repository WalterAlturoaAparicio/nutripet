import { reply, route } from '@/server/http/handler';
import { requireProfile } from '@/server/auth/require-profile';
import { duplicateMealSchema } from '@/server/validation/journal';
import { duplicateMeal } from '@/server/modules/journal/service';

export const POST = route({ body: duplicateMealSchema }, (ctx, { body, params }) =>
  reply(duplicateMeal(requireProfile(ctx).profileId, params.mealId!, body), 201),
);
