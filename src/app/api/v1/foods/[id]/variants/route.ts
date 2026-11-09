import { route } from '@/server/http/handler';
import { requireProfile } from '@/server/auth/require-profile';
import { siblingVariants } from '@/server/modules/foods/service';

// Other preparation-state variants of the same food (e.g. raw ↔ cooked) for one-tap switching (U4).
export const GET = route({}, (ctx, { params }) => siblingVariants(requireProfile(ctx).profileId, params.id!));
