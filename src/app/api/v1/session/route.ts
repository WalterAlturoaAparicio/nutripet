import { noContent, route } from '@/server/http/handler';
import { loginSchema } from '@/server/validation/profile';
import { login } from '@/server/modules/profiles/service';
import { destroySession } from '@/server/auth/session';

export const POST = route({ body: loginSchema, public: true }, async (ctx, { body }) => {
  await login(ctx, body);
  return noContent();
});

export const DELETE = route({ public: true }, (ctx) => {
  destroySession(ctx);
  return noContent();
});
