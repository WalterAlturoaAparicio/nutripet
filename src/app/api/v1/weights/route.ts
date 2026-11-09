import { reply, route } from '@/server/http/handler';
import { requireProfile } from '@/server/auth/require-profile';
import { createWeightSchema, weightQuerySchema } from '@/server/validation/weight';
import { addWeight, listWeights } from '@/server/modules/weight/service';

export const GET = route({ query: weightQuerySchema }, (ctx, { query }) => listWeights(requireProfile(ctx).profileId, query));

export const POST = route({ body: createWeightSchema }, (ctx, { body }) => reply(addWeight(requireProfile(ctx).profileId, body), 201));
