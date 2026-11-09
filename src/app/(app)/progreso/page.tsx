'use client';

import { t } from '@/i18n/es';
import { Spinner } from '@/ui/kit';
import { useMe, useToday } from '@/ui/hooks';
import { WeightSection } from '@/ui/weight/WeightSection';
import { ProgressSummaries } from '@/ui/progress/ProgressSummaries';

export default function ProgressPage() {
  const me = useMe();
  const today = useToday(me);
  if (!me || !today) return <Spinner />;
  return (
    <div>
      <h1 className="mb-4 pr-12 text-2xl font-bold">{t('progress.title')}</h1>
      <WeightSection unit={me.profile.weightUnit} today={today} />
      <ProgressSummaries today={today} />
    </div>
  );
}
