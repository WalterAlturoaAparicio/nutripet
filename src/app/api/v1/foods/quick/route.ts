import { route } from '@/server/http/handler';
import { requireProfile } from '@/server/auth/require-profile';
import { quickLists } from '@/server/modules/foods/custom';

export const GET = route({}, (ctx) => quickLists(requireProfile(ctx).profileId));
