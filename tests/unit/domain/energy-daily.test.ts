import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { activityNetKcal, balanceLabel, dailyEnergy } from '@/domain/energy';
import { buildDayEnergySnapshot, dayEnergyFromSnapshot } from '@/domain/energy/settings';
import type { SettingsVersion } from '@/domain/types';

describe('activityNetKcal', () => {
  it('(MET − 1) × kg × hours: running MET 9.8, 66 kg, 30 min → 290.4', () => {
    expect(activityNetKcal({ met: 9.8, weightKg: 66, durationMin: 30 })).toBeCloseTo(290.4, 9);
  });
  it('never negative; MET ≤ 1 adds nothing above resting', () => {
    expect(activityNetKcal({ met: 1, weightKg: 70, durationMin: 60 })).toBe(0);
    expect(activityNetKcal({ met: 0.9, weightKg: 70, durationMin: 60 })).toBe(0);
  });
});

describe('dailyEnergy (balance = expenditure − intake)', () => {
  it('2400 vs 2000 → +400 estimated deficit', () => {
    expect(dailyEnergy({ baselineTdee: 2400, activityNetKcal: [], intakeKcal: 2000 })).toMatchObject({
      expenditureKcal: 2400,
      balanceKcal: 400,
      balanceLabel: 'deficit',
    });
  });
  it('2400 vs 2700 → −300 estimated surplus', () => {
    expect(dailyEnergy({ baselineTdee: 2400, activityNetKcal: [], intakeKcal: 2700 })).toMatchObject({ balanceKcal: -300, balanceLabel: 'surplus' });
  });
  it('2400 vs 2400 → 0 estimated maintenance', () => {
    expect(dailyEnergy({ baselineTdee: 2400, activityNetKcal: [], intakeKcal: 2400 }).balanceLabel).toBe('maintenance');
  });
  it('adds net activity to the baseline', () => {
    const r = dailyEnergy({ baselineTdee: 2000, activityNetKcal: [290.4, 0, 100], intakeKcal: 2000 });
    expect(r.activityNetKcal).toBeCloseTo(390.4, 9);
    expect(r.expenditureKcal).toBeCloseTo(2390.4, 9);
  });
  it('property: the label always matches the sign', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 800, max: 5000, noNaN: true }),
        fc.array(fc.double({ min: 0, max: 1500, noNaN: true }), { maxLength: 5 }),
        fc.double({ min: 0, max: 8000, noNaN: true }),
        (base, acts, intake) => {
          const r = dailyEnergy({ baselineTdee: base, activityNetKcal: acts, intakeKcal: intake });
          expect(r.balanceLabel).toBe(r.balanceKcal > 0 ? 'deficit' : r.balanceKcal < 0 ? 'surplus' : 'maintenance');
          expect(balanceLabel(r.balanceKcal)).toBe(r.balanceLabel);
        },
      ),
    );
  });
});

describe('dayEnergyFromSnapshot', () => {
  it('uses the frozen baseline TDEE', () => {
    const settings: SettingsVersion = {
      id: 'v1', effectiveFrom: '2026-11-01', createdAt: '2026-11-01T00:00:00Z', birthDate: '1996-01-01', sexForFormula: 'female',
      heightCm: 165, goalType: 'loss', activityLevel: 'light', activityMultiplier: 1.375, bmrFormula: 'mifflin_st_jeor',
      calorieAdjustmentKcal: -400, calorieTargetOverrideKcal: null, proteinTargetG: null, carbsTargetG: null, fatTargetG: null, calcVersion: 1,
    };
    const snap = buildDayEnergySnapshot({ settings, weight: { weightKg: 65, recordId: 'w' }, date: '2026-11-05' });
    const r = dayEnergyFromSnapshot(snap, [200], 1800);
    expect(r.expenditureKcal).toBeCloseTo(snap.baselineTdeeKcal + 200, 9);
    expect(r.balanceKcal).toBeCloseTo(snap.baselineTdeeKcal + 200 - 1800, 9);
  });
});
