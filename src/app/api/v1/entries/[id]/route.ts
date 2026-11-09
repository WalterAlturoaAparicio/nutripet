import { route } from '@/server/http/handler';
import { requireProfile } from '@/server/auth/require-profile';
import { updateEntrySchema } from '@/server/validation/journal';
import { deleteEntry, updateEntry } from '@/server/modules/journal/service';

export const PATCH = route({ body: updateEntrySchema }, (ctx, { body, params }) => updateEntry(requireProfile(ctx).profileId, params.id!, body));

export const DELETE = route({}, (ctx, { params }) => deleteEntry(requireProfile(ctx).profileId, params.id!));
