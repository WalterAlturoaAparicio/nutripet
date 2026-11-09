import { reply, route } from '@/server/http/handler';
import { requireProfile } from '@/server/auth/require-profile';
import { recipeSchema } from '@/server/validation/recipes';
import { createRecipe, listRecipes } from '@/server/modules/recipes/service';

export const GET = route({}, (ctx) => listRecipes(requireProfile(ctx).profileId));

export const POST = route({ body: recipeSchema }, (ctx, { body }) => reply(createRecipe(requireProfile(ctx).profileId, body), 201));
