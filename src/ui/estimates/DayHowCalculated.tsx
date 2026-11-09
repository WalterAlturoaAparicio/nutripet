'use client';

import { HowCalculated } from '@/ui/estimates/HowCalculated';
import type { DaySummary, MeLite } from '@/ui/types';

/** "¿Cómo se calcula?" for a specific day, from its frozen snapshot, including exercise (FR-018, T078). */
export function DayHowCalculated({ day, me }: { day: DaySummary; me: MeLite }) {
  const e = day.estimates;
  if (!e) return null;
  return (
    <HowCalculated
      energy={{
        formula: e.formula,
        bmrKcal: e.bmrKcal,
        activityMultiplier: e.activityMultiplier,
        baselineTdeeKcal: e.baselineTdeeKcal,
        adjustmentKcal: e.adjustmentKcal,
        recommendedTargetKcal: day.target.recommendedKcal,
        activeTargetKcal: day.target.activeKcal,
        targetIsOverride: day.target.isOverride,
      }}
      inputs={{ weightKg: e.inputs.weightKg, heightCm: me.settings.heightCm, age: e.inputs.age, sex: me.settings.sexForFormula }}
      weightUnit={me.profile.weightUnit}
      effectiveFrom={e.inputs.effectiveFrom}
      frozen={e.snapshot?.frozen}
      exercise={day.activities.map((a) => ({ name: a.name, met: a.metUsed, durationMin: a.durationMin, netKcal: a.netKcal, method: a.estimateMethod }))}
    />
  );
}
