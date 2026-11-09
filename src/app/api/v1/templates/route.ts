import { reply, route } from '@/server/http/handler';
import { requireProfile } from '@/server/auth/require-profile';
import { createTemplateSchema } from '@/server/validation/journal';
import { createTemplate, listTemplates } from '@/server/modules/journal/templates';

export const GET = route({}, (ctx) => listTemplates(requireProfile(ctx).profileId));

export const POST = route({ body: createTemplateSchema }, (ctx, { body }) => reply(createTemplate(requireProfile(ctx).profileId, body), 201));
