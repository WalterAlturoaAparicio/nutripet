/** Wires the pet into profile creation, the selector, tracking events and day summaries (US7). */
import { extendDaySummary, onTracking } from '../events';
import type { DaySummary } from '../journal/service';
import { onProfileCreated, registerPetLookup } from '../profiles/hooks';
import { createPetForProfile, onTrackingEvent, petsFor, xpAwardedFor } from './service';

onProfileCreated(createPetForProfile);
registerPetLookup(petsFor);
// Registered after the calendar listener (see register.ts), so day completion is already up to date.
onTracking(onTrackingEvent);
extendDaySummary<DaySummary>((profileId, date, summary) => {
  summary.xpAwarded = xpAwardedFor(profileId, date);
});
