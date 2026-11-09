import { route } from '@/server/http/handler';
import { requireProfile } from '@/server/auth/require-profile';
import { feedPet } from '@/server/modules/pet/service';

export const POST = route({}, (ctx) => feedPet(requireProfile(ctx).profileId));
