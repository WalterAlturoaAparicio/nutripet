import { DEFAULT_ACTIVITY_METS } from '@/domain/config';
import { activityType } from '../schema';
import { registerSeeder } from './index';

const ICONS: Record<string, string> = {
  walking: '🚶',
  running: '🏃',
  swimming: '🏊',
  cycling: '🚴',
  strength: '🏋️',
  volleyball: '🏐',
  basketball: '🏀',
  tennis: '🎾',
};

/** Built-in activity types with editable default METs (2024 Adult Compendium of Physical Activities). */
registerSeeder({
  name: 'activity-types',
  run: (d) => {
    for (const [key, a] of Object.entries(DEFAULT_ACTIVITY_METS)) {
      d.insert(activityType)
        .values({
          id: `builtin:${key}`,
          ownerProfileId: null,
          nameEs: a.nameEs,
          icon: ICONS[key] ?? null,
          metLight: a.mets.light,
          metModerate: a.mets.moderate,
          metVigorous: a.mets.vigorous,
          compendiumCode: a.compendiumCode,
          createdAt: new Date(0).toISOString(),
        })
        .onConflictDoNothing()
        .run();
    }
  },
});
