import { parseOrThrow, reply, route } from '@/server/http/handler';
import { requireProfile } from '@/server/auth/require-profile';
import { addEntrySchema, dateParam } from '@/server/validation/journal';
import { addEntry } from '@/server/modules/journal/service';

export const POST = route({ body: addEntrySchema }, (ctx, { body, params }) =>
  reply(addEntry(requireProfile(ctx).profileId, parseOrThrow(dateParam, params.date), body), 201),
);
