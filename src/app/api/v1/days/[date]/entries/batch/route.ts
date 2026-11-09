import { parseOrThrow, reply, route } from '@/server/http/handler';
import { requireProfile } from '@/server/auth/require-profile';
import { batchEntriesSchema, dateParam } from '@/server/validation/journal';
import { addBatch } from '@/server/modules/journal/service';

export const POST = route({ body: batchEntriesSchema }, (ctx, { body, params }) =>
  reply(addBatch(requireProfile(ctx).profileId, parseOrThrow(dateParam, params.date), body), 201),
);
