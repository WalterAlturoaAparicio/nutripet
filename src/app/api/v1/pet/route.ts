import { z } from 'zod';
import { route } from '@/server/http/handler';
import { requireProfile } from '@/server/auth/require-profile';
import { getPet, updatePet } from '@/server/modules/pet/service';

const patch = z
  .object({ name: z.string().trim().min(1, 'Escribe un nombre.').max(24).optional(), equippedAccessoryIds: z.array(z.string().max(20)).max(5).optional() })
  .strict();

export const GET = route({}, (ctx) => getPet(requireProfile(ctx).profileId));

export const PATCH = route({ body: patch }, (ctx, { body }) => updatePet(requireProfile(ctx).profileId, body));
