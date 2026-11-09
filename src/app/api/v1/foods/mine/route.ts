import { route } from '@/server/http/handler';
import { requireProfile } from '@/server/auth/require-profile';
import { myFoods } from '@/server/modules/foods/custom';

export const GET = route({}, (ctx) => myFoods(requireProfile(ctx).profileId));
