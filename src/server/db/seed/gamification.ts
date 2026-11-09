import { MILESTONE_REWARDS, STREAK_MILESTONES } from '@/domain/gamification';
import { STAGE_THRESHOLDS } from '@/domain/config';
import { accessory, milestone } from '../schema';
import { registerSeeder } from './index';

const ACCESSORIES = [
  { id: 'gorro', nameEs: 'Gorro' },
  { id: 'bufanda', nameEs: 'Bufanda' },
  { id: 'mono', nameEs: 'Moño' },
  { id: 'gafas', nameEs: 'Gafas' },
  { id: 'corona', nameEs: 'Corona' },
];

/** Milestones and accessories are identical for every goal (FR-072). */
registerSeeder({
  name: 'gamification',
  run: (d) => {
    for (const a of ACCESSORIES) d.insert(accessory).values(a).onConflictDoNothing().run();
    const rows = [
      ...STREAK_MILESTONES.map((n) => ({ id: `streak_${n}` as const, kind: 'streak' as const, threshold: n })),
      { id: 'first_full_week' as const, kind: 'first_full_week' as const, threshold: 7 },
      ...(['young', 'adolescent', 'adult', 'special'] as const).map((s) => ({ id: `stage_${s}` as const, kind: 'stage' as const, threshold: STAGE_THRESHOLDS[s] })),
    ];
    for (const r of rows) {
      const reward = MILESTONE_REWARDS[r.id];
      const values = { ...r, xpReward: reward.xp, treatReward: reward.treats, accessoryId: reward.accessory };
      d.insert(milestone).values(values).onConflictDoUpdate({ target: milestone.id, set: values }).run();
    }
  },
});
