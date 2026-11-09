import { noContent, route } from '@/server/http/handler';
import { requireProfile } from '@/server/auth/require-profile';
import { revokeDevice } from '@/server/auth/device';

export const DELETE = route({}, (ctx, { params }) => {
  requireProfile(ctx);
  revokeDevice(params.id!);
  return noContent();
});
