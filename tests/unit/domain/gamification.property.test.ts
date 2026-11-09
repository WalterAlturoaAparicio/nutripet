import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { addDays } from '@/domain/dates';
import { simulateRewards, type SimAction } from '@/domain/gamification/simulate';
import type { GoalType } from '@/domain/types';

const action: fc.Arbitrary<SimAction> = fc.oneof(
  fc.record({ kind: fc.constant('food' as const), occasion: fc.integer({ min: 0, max: 4 }), kcal: fc.double({ min: 0, max: 2000, noNaN: true }) }),
  fc.record({ kind: fc.constant('activity' as const) }),
  fc.record({ kind: fc.constant('weight' as const) }),
  fc.record({ kind: fc.constant('delete_last_food' as const) }),
);
const dayActions = fc.array(action, { maxLength: 8 });
const timeline = fc.array(dayActions, { minLength: 1, maxLength: 40 });

describe('gamification properties (FR-072, FR-074, SC-007)', () => {
  it('two profiles with the same actions but different goals and kcal get identical rewards', () => {
    fc.assert(
      fc.property(timeline, fc.constantFrom<GoalType>('gain', 'loss', 'maintenance'), fc.constantFrom<GoalType>('gain', 'loss', 'maintenance'), (tl, g1, g2) => {
        const scaled = tl.map((day) => day.map((a) => (a.kind === 'food' ? { ...a, kcal: a.kcal * 3 + 500 } : a)));
        const r1 = simulateRewards(tl, g1, '2026-01-01');
        const r2 = simulateRewards(scaled, g2, '2026-01-01');
        expect({ ...r2, messages: undefined }).toEqual({ ...r1, messages: undefined });
      }),
    );
  });

  it('XP total never decreases over missed days and stage never decreases under any sequence', () => {
    fc.assert(
      fc.property(timeline, fc.nat(20), (tl, gap) => {
        const withGap = [...tl, ...Array.from({ length: gap }, () => [] as SimAction[])];
        const before = simulateRewards(tl, 'gain', '2026-01-01');
        const after = simulateRewards(withGap, 'gain', '2026-01-01');
        expect(after.xpTotal).toBeGreaterThanOrEqual(before.xpTotal);
        expect(after.stageHistory.every((s, i, arr) => i === 0 || s >= arr[i - 1]!)).toBe(true);
        expect(after.treats).toBeGreaterThanOrEqual(0);
        void addDays;
      }),
    );
  });
});
