import { route } from '@/server/http/handler';
import { requireProfile } from '@/server/auth/require-profile';
import { updateMealSchema } from '@/server/validation/journal';
import { updateMeal } from '@/server/modules/journal/service';

/** Saves the complete content of an existing meal (FR-035a). */
export const PUT = route({ body: updateMealSchema }, (ctx, { body, params }) => updateMeal(requireProfile(ctx).profileId, params.mealId!, body));
