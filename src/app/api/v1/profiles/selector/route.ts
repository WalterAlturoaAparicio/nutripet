import { route } from '@/server/http/handler';
import { listSelector } from '@/server/modules/profiles/service';

export const GET = route({ public: true }, (ctx) => listSelector(ctx));
