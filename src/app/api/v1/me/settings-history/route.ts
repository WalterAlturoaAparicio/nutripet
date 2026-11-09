import { route } from '@/server/http/handler';
import { requireProfile } from '@/server/auth/require-profile';
import { settingsHistory } from '@/server/modules/profiles/service';

export const GET = route({}, (ctx) => settingsHistory(requireProfile(ctx).profileId));
