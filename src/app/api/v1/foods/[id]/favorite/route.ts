import { noContent, route } from '@/server/http/handler';
import { requireProfile } from '@/server/auth/require-profile';
import { setFavorite } from '@/server/modules/foods/custom';

export const PUT = route({}, (ctx, { params }) => {
  setFavorite(requireProfile(ctx).profileId, params.id!, true);
  return noContent();
});

export const DELETE = route({}, (ctx, { params }) => {
  setFavorite(requireProfile(ctx).profileId, params.id!, false);
  return noContent();
});
