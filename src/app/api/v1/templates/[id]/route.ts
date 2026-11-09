import { noContent, route } from '@/server/http/handler';
import { requireProfile } from '@/server/auth/require-profile';
import { deleteTemplate, getTemplate } from '@/server/modules/journal/templates';

export const GET = route({}, (ctx, { params }) => getTemplate(requireProfile(ctx).profileId, params.id!));

export const DELETE = route({}, (ctx, { params }) => {
  deleteTemplate(requireProfile(ctx).profileId, params.id!);
  return noContent();
});
