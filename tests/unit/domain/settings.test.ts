import { describe, expect, it } from 'vitest';
import { buildDayEnergySnapshot, dayEnergyFromSnapshot, effectiveSettings, weightForDate } from '@/domain/energy/settings';
import type { SettingsVersion, WeightRecordLike } from '@/domain/types';

const base: Omit<SettingsVersion, 'id' | 'effectiveFrom' | 'createdAt' | 'activityLevel' | 'activityMultiplier'> = {
  birthDate: '1996-01-15',
  sexForFormula: 'male',
  heightCm: 180,
  goalType: 'gain',
  bmrFormula: 'mifflin_st_jeor',
  calorieAdjustmentKcal: 300,
  calorieTargetOverrideKcal: null,
  proteinTargetG: null,
  carbsTargetG: null,
  fatTargetG: null,
  calcVersion: 1,
};

const v1: SettingsVersion = {
  ...base,
  id: 'v1',
  effectiveFrom: '2026-11-01',
  createdAt: '2026-11-01T15:00:00Z',
  activityLevel: 'moderate',
  activityMultiplier: 1.55,
};
const v2: SettingsVersion = {
  ...base,
  id: 'v2',
  effectiveFrom: '2026-11-10',
  createdAt: '2026-11-10T15:00:00Z',
  activityLevel: 'light',
  activityMultiplier: 1.375,
};

describe('effectiveSettings', () => {
  it('resolves the version in effect on a date', () => {
    expect(effectiveSettings([v1, v2], '2026-11-05').id).toBe('v1');
    expect(effectiveSettings([v1, v2], '2026-11-10').id).toBe('v2');
    expect(effectiveSettings([v2, v1], '2026-12-01').id).toBe('v2');
  });
  it('uses the first version for dates before it', () => {
    expect(effectiveSettings([v1, v2], '2026-10-20').id).toBe('v1');
  });
  it('picks the latest createdAt among versions effective the same day', () => {
    const v2b = { ...v2, id: 'v2b', createdAt: '2026-11-10T18:00:00Z' };
    expect(effectiveSettings([v1, v2b, v2], '2026-11-10').id).toBe('v2b');
  });
  it('throws without versions', () => {
    expect(() => effectiveSettings([], '2026-11-10')).toThrow();
  });
});

describe('weightForDate', () => {
  const records: WeightRecordLike[] = [
    { id: 'w1', localDate: '2026-11-01', weightKg: 66, createdAt: '2026-11-01T12:00:00Z' },
    { id: 'w2', localDate: '2026-11-07', weightKg: 67, createdAt: '2026-11-07T12:00:00Z' },
    { id: 'w3', localDate: '2026-11-07', weightKg: 67.4, createdAt: '2026-11-07T20:00:00Z' },
  ];
  it('uses the latest record on or before the date', () => {
    expect(weightForDate(records, '2026-11-05')).toEqual({ weightKg: 66, recordId: 'w1' });
    expect(weightForDate(records, '2026-11-07')).toEqual({ weightKg: 67.4, recordId: 'w3' });
  });
  it('falls back to the earliest record', () => {
    expect(weightForDate(records, '2026-10-30')).toEqual({ weightKg: 66, recordId: 'w1' });
  });
});

describe('buildDayEnergySnapshot', () => {
  it('freezes inputs and results for a day', () => {
    const snap = buildDayEnergySnapshot({
      settings: { ...v1, birthDate: '1996-11-05' },
      weight: { weightKg: 80, recordId: 'w1' },
      date: '2026-11-05',
    });
    expect(snap).toMatchObject({
      localDate: '2026-11-05',
      settingsVersionId: 'v1',
      weightKg: 80,
      weightRecordId: 'w1',
      age: 30,
      bmrKcal: 1780,
      activityMultiplier: 1.55,
      adjustmentKcal: 300,
      targetIsOverride: false,
      calcVersion: 1,
    });
    expect(snap.baselineTdeeKcal).toBeCloseTo(2759, 9);
    expect(snap.activeTargetKcal).toBeCloseTo(3059, 9);
  });

  it('a snapshot built before a new version is unchanged after the version is added', () => {
    const weights: WeightRecordLike[] = [
      { id: 'w1', localDate: '2026-11-01', weightKg: 80, createdAt: '2026-11-01T12:00:00Z' },
    ];
    const build = (versions: SettingsVersion[]) =>
      buildDayEnergySnapshot({
        settings: effectiveSettings(versions, '2026-11-05'),
        weight: weightForDate(weights, '2026-11-05'),
        date: '2026-11-05',
      });
    expect(JSON.stringify(build([v1, v2]))).toBe(JSON.stringify(build([v1])));
  });
});

describe('dayEnergyFromSnapshot', () => {
  it('computes expenditure and balance from the snapshot', () => {
    const snap = buildDayEnergySnapshot({
      settings: { ...v1, birthDate: '1996-11-05' },
      weight: { weightKg: 80, recordId: 'w1' },
      date: '2026-11-05',
    });
    const r = dayEnergyFromSnapshot(snap, [100], 2500);
    expect(r.expenditureKcal).toBeCloseTo(2859, 9);
    expect(r.balanceKcal).toBeCloseTo(359, 9);
    expect(r.balanceLabel).toBe('deficit');
  });
});
