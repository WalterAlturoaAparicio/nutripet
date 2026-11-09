import { route } from '@/server/http/handler';
import { requireProfile } from '@/server/auth/require-profile';
import { currentDevice, listDevices } from '@/server/auth/device';

export const GET = route({}, (ctx) => {
  requireProfile(ctx);
  const current = currentDevice(ctx)?.id;
  return listDevices().map((d) => ({ ...d, isCurrent: d.id === current }));
});
