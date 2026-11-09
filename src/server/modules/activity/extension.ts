/** Adds activities and estimated expenditure/balance (from the day snapshot) to every day summary (US3). */
import { dailyEnergy } from '@/domain/energy';
import { getDayEnergy } from '../day-energy/service';
import { extendDaySummary } from '../events';
import type { DaySummary } from '../journal/service';
import { dayActivities, toView } from './service';

extendDaySummary<DaySummary>((profileId, date, summary) => {
  const activities = dayActivities(profileId, date);
  const { snapshot, persisted, frozen, effectiveFrom } = getDayEnergy(profileId, date);
  const energy = dailyEnergy({
    baselineTdee: snapshot.baselineTdeeKcal,
    activityNetKcal: activities.map((a) => a.netKcal),
    intakeKcal: summary.totals.kcal,
  });
  summary.activities = activities.map(toView);
  summary.estimates = {
    formula: snapshot.bmrFormula,
    bmrKcal: snapshot.bmrKcal,
    activityMultiplier: snapshot.activityMultiplier,
    baselineTdeeKcal: snapshot.baselineTdeeKcal,
    adjustmentKcal: snapshot.adjustmentKcal,
    activityNetKcal: energy.activityNetKcal,
    expenditureKcal: energy.expenditureKcal,
    balanceKcal: energy.balanceKcal,
    balanceLabel: energy.balanceLabel,
    snapshot: persisted
      ? {
          settingsVersionId: snapshot.settingsVersionId,
          effectiveFrom,
          weightKg: snapshot.weightKg,
          age: snapshot.age,
          calcVersion: snapshot.calcVersion,
          frozen,
        }
      : null,
    inputs: { weightKg: snapshot.weightKg, age: snapshot.age, effectiveFrom },
    isEstimate: true,
  };
});
