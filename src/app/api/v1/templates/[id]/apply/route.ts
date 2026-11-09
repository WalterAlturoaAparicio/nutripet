import { reply, route } from '@/server/http/handler';
import { requireProfile } from '@/server/auth/require-profile';
import { applyTemplateSchema } from '@/server/validation/journal';
import { applyTemplate } from '@/server/modules/journal/templates';

export const POST = route({ body: applyTemplateSchema }, (ctx, { body, params }) =>
  reply(applyTemplate(requireProfile(ctx).profileId, params.id!, body), 201),
);
