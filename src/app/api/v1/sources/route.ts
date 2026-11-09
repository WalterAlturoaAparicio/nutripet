import { route } from '@/server/http/handler';
import { requireProfile } from '@/server/auth/require-profile';
import { listSources } from '@/server/modules/foods/service';

export const GET = route({}, (ctx) => {
  requireProfile(ctx);
  return listSources();
});
