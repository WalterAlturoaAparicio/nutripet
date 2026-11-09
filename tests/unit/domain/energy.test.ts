import { describe, expect, it } from 'vitest';
import {
  activityMultiplier,
  ageOn,
  baselineTdee,
  bmr,
  energyProfile,
  recommendedTarget,
  targetCaution,
} from '@/domain/energy';

describe('ageOn', () => {
  it('counts completed years, including on the birthday', () => {
    expect(ageOn('1996-11-08', '2026-11-07')).toBe(29);
    expect(ageOn('1996-11-08', '2026-11-08')).toBe(30);
    expect(ageOn('2000-02-29', '2026-02-28')).toBe(25);
    expect(ageOn('2000-02-29', '2026-03-01')).toBe(26);
  });
});

describe('bmr', () => {
  it('Mifflin-St Jeor male 80 kg, 180 cm, 30 y → 1780', () => {
    expect(bmr({ formula: 'mifflin_st_jeor', sex: 'male', weightKg: 80, heightCm: 180, age: 30 })).toBe(1780);
  });
  it('Mifflin-St Jeor female 65 kg, 165 cm, 28 y → 1380.25', () => {
    expect(bmr({ formula: 'mifflin_st_jeor', sex: 'female', weightKg: 65, heightCm: 165, age: 28 })).toBe(1380.25);
  });
  it('unspecified sex uses the −78 constant', () => {
    expect(bmr({ formula: 'mifflin_st_jeor', sex: 'unspecified', weightKg: 80, heightCm: 180, age: 30 })).toBe(
      1780 - 5 - 78,
    );
  });
  it('Harris-Benedict revised', () => {
    expect(bmr({ formula: 'harris_benedict_revised', sex: 'male', weightKg: 80, heightCm: 180, age: 30 })).toBeCloseTo(
      88.362 + 13.397 * 80 + 4.799 * 180 - 5.677 * 30,
      9,
    );
    expect(
      bmr({ formula: 'harris_benedict_revised', sex: 'female', weightKg: 65, heightCm: 165, age: 28 }),
    ).toBeCloseTo(447.593 + 9.247 * 65 + 3.098 * 165 - 4.33 * 28, 9);
    const male = bmr({ formula: 'harris_benedict_revised', sex: 'male', weightKg: 70, heightCm: 170, age: 40 });
    const female = bmr({ formula: 'harris_benedict_revised', sex: 'female', weightKg: 70, heightCm: 170, age: 40 });
    expect(bmr({ formula: 'harris_benedict_revised', sex: 'unspecified', weightKg: 70, heightCm: 170, age: 40 })).toBeCloseTo(
      (male + female) / 2,
      9,
    );
  });
});

describe('TDEE and targets', () => {
  it('multipliers', () => {
    expect(activityMultiplier('sedentary')).toBe(1.2);
    expect(activityMultiplier('light')).toBe(1.375);
    expect(activityMultiplier('moderate')).toBe(1.55);
    expect(activityMultiplier('high')).toBe(1.725);
    expect(activityMultiplier('very_high')).toBe(1.9);
  });
  it('1780 × 1.55 = 2759; +300 → 3059; −400 → 2359', () => {
    const tdee = baselineTdee(1780, 1.55);
    expect(tdee).toBeCloseTo(2759, 9);
    expect(recommendedTarget(tdee, 300)).toBeCloseTo(3059, 9);
    expect(recommendedTarget(tdee, -400)).toBeCloseTo(2359, 9);
  });
});

describe('targetCaution', () => {
  it('flags targets below max(BMR, 1200)', () => {
    expect(targetCaution({ target: 1150, bmr: 1380, baselineTdee: 2000, adjustmentKcal: -100 })).toBe(
      'target_below_safety',
    );
    expect(targetCaution({ target: 1300, bmr: 1380, baselineTdee: 1500, adjustmentKcal: -200 })).toBe(
      'target_below_safety',
    );
  });
  it('flags adjustments over 25% of baseline TDEE', () => {
    expect(targetCaution({ target: 1959, bmr: 1780, baselineTdee: 2759, adjustmentKcal: -800 })).toBe(
      'adjustment_over_25pct',
    );
    expect(targetCaution({ target: 3559, bmr: 1780, baselineTdee: 2759, adjustmentKcal: 800 })).toBe(
      'adjustment_over_25pct',
    );
  });
  it('returns null for moderate plans', () => {
    expect(targetCaution({ target: 2359, bmr: 1780, baselineTdee: 2759, adjustmentKcal: -400 })).toBeNull();
  });
});

describe('energyProfile', () => {
  it('combines inputs and marks results as estimates', () => {
    const p = energyProfile({
      formula: 'mifflin_st_jeor',
      sex: 'male',
      weightKg: 80,
      heightCm: 180,
      age: 30,
      activityMultiplier: 1.55,
      adjustmentKcal: 300,
      overrideKcal: null,
    });
    expect(p).toMatchObject({
      bmrKcal: 1780,
      recommendedTargetKcal: expect.closeTo(3059, 6),
      activeTargetKcal: expect.closeTo(3059, 6),
      targetIsOverride: false,
      isEstimate: true,
    });
    expect(p.caution).toBeUndefined();
  });
  it('uses the manual override as the active target and checks it for safety', () => {
    const p = energyProfile({
      formula: 'mifflin_st_jeor',
      sex: 'female',
      weightKg: 65,
      heightCm: 165,
      age: 28,
      activityMultiplier: 1.2,
      adjustmentKcal: -300,
      overrideKcal: 1100,
    });
    expect(p.activeTargetKcal).toBe(1100);
    expect(p.targetIsOverride).toBe(true);
    expect(p.caution).toBe('target_below_safety');
  });
});
