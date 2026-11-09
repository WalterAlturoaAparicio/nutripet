import { route } from '@/server/http/handler';
import { pinResetSchema } from '@/server/validation/profile';
import { resetPin } from '@/server/modules/profiles/service';

export const POST = route({ body: pinResetSchema, public: true }, (ctx, { body, params }) => resetPin(ctx, params.id!, body));
