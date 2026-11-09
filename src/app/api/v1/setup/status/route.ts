import { route } from '@/server/http/handler';
import { currentDevice } from '@/server/auth/device';
import { profileCount } from '@/server/auth/setup-token';

// Public: reveals only two booleans, never names or counts (FR-008).
export const GET = route({ public: true }, (ctx) => ({
  needsInitialSetup: profileCount() === 0,
  deviceEnrolled: currentDevice(ctx) !== null,
}));
