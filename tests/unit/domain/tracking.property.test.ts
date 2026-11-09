import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { addDays } from '@/domain/dates';
import { computeStreaks, dayStatus } from '@/domain/tracking';
import type { DayStatus } from '@/domain/types';

const STATUSES: DayStatus[] = ['none', 'activity_only', 'food_partial', 'food_completed', 'full_completed', 'rest_completed'];
const timeline = fc.array(fc.record({ status: fc.constantFrom(...STATUSES), eligible: fc.boolean() }), { minLength: 1, maxLength: 90 });

describe('tracking properties', () => {
  it('day status never depends on calories or targets (inputs contain none)', () => {
    fc.assert(
      fc.property(fc.nat(30), fc.nat(6), fc.boolean(), fc.nat(5), fc.boolean(), fc.double(), fc.double(), (n, occ, mark, act, rest, kcal, target) => {
        const input = { foodEntryCount: n, occasionsWithEntries: Math.min(occ, n), markedComplete: mark, activityCount: act, restDay: rest };
        const withNoise = { ...input, kcal, target } as unknown as typeof input;
        expect(dayStatus(withNoise)).toBe(dayStatus(input));
      }),
    );
  });

  it('freezes stay within 0..2, consumption never exceeds earnings, completed ≤ recorded', () => {
    fc.assert(
      fc.property(timeline, (tl) => {
        const days = tl.map((d, i) => ({ date: addDays('2026-01-01', i), status: d.status, rewardEligible: d.eligible }));
        const r = computeStreaks(days, addDays('2026-01-01', tl.length - 1));
        expect(r.freezesAvailable).toBeGreaterThanOrEqual(0);
        expect(r.freezesAvailable).toBeLessThanOrEqual(2);
        expect(r.frozenDates.length).toBeLessThanOrEqual(Math.floor(r.eligibleCompletedDays / 7));
        expect(r.totalCompletedDays).toBeLessThanOrEqual(r.totalRecordedDays);
        expect(r.current).toBeLessThanOrEqual(r.longest);
      }),
    );
  });
});
