import { reply, route } from '@/server/http/handler';
import { requireProfile } from '@/server/auth/require-profile';
import { issuePairingCode } from '@/server/auth/device';

export const POST = route({}, async (ctx) => {
  const { profileId } = requireProfile(ctx);
  return reply(await issuePairingCode(profileId), 201);
});
