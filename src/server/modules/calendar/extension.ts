/** Keeps day completion and streaks current after every tracking change, and adds status to day summaries (US6). */
import { foodCompleted } from '@/domain/tracking';
import { extendDaySummary, onTracking } from '../events';
import type { DaySummary } from '../journal/service';
import { dayFlags, recomputeStreak, statusFor, updateDayCompletion } from './service';

onTracking((e) => {
  updateDayCompletion(e.profileId, e.date);
  recomputeStreak(e.profileId);
});

extendDaySummary<DaySummary>((profileId, date, summary) => {
  const { status, row } = statusFor(profileId, date);
  summary.status = status;
  summary.foodCompleted = row ? foodCompleted(row) : false;
  summary.flags = dayFlags(profileId, date);
});
