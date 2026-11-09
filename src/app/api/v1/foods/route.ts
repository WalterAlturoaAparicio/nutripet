import { z } from 'zod';
import { reply, route } from '@/server/http/handler';
import { requireProfile } from '@/server/auth/require-profile';
import { FOOD_CATEGORIES } from '@/server/db/schema';
import { searchFoods } from '@/server/modules/foods/service';
import { createCustomFood } from '@/server/modules/foods/custom';
import { createCustomFoodSchema } from '@/server/validation/foods';

const query = z.object({
  q: z.string().max(80).optional(),
  category: z.enum(FOOD_CATEGORIES).optional(),
  state: z.enum(['raw', 'cooked', 'prepared', 'packaged']).optional(),
  branded: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export const GET = route({ query }, (ctx, { query: q }) => searchFoods(requireProfile(ctx).profileId, q));

export const POST = route({ body: createCustomFoodSchema }, (ctx, { body }) => reply(createCustomFood(requireProfile(ctx).profileId, body), 201));
