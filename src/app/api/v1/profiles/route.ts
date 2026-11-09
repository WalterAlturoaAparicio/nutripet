import { reply, route } from '@/server/http/handler';
import { createProfileSchema } from '@/server/validation/profile';
import { createProfile } from '@/server/modules/profiles/service';

export const POST = route({ body: createProfileSchema, public: true }, async (ctx, { body }) => reply(await createProfile(ctx, body), 201));
