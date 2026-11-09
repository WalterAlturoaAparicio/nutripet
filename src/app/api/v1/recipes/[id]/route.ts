import { noContent, route } from '@/server/http/handler';
import { requireProfile } from '@/server/auth/require-profile';
import { recipeSchema, recipeVersionQuery } from '@/server/validation/recipes';
import { getRecipe, hideRecipe, updateRecipe } from '@/server/modules/recipes/service';

/** Current version, or `?versionId=` for the exact version a meal entry used. */
export const GET = route({ query: recipeVersionQuery }, (ctx, { query, params }) =>
  getRecipe(requireProfile(ctx).profileId, params.id!, query.versionId),
);

/** Saves a new version; meals already logged keep the version they used (FR-046). */
export const PUT = route({ body: recipeSchema }, (ctx, { body, params }) => updateRecipe(requireProfile(ctx).profileId, params.id!, body));

export const DELETE = route({}, (ctx, { params }) => {
  hideRecipe(requireProfile(ctx).profileId, params.id!);
  return noContent();
});
