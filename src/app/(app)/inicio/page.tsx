'use client';

import { useCallback, useEffect, useState } from 'react';
import { t } from '@/i18n/es';
import { api } from '@/ui/api';
import { ErrorNote, Sheet, Spinner } from '@/ui/kit';
import { AddFoodFlow } from '@/ui/journal/AddFoodFlow';
import { ActivityForm } from '@/ui/activity/ActivityForm';
import { CalorieProgress, EnergyBalanceCard, MacroBars } from '@/ui/dashboard/widgets';
import { DayHowCalculated } from '@/ui/estimates/DayHowCalculated';
import { HomePet } from '@/ui/pet/HomePet';
import { StreakBadge } from '@/ui/dashboard/StreakBadge';
import { useMe, useToday } from '@/ui/hooks';
import type { DaySummary } from '@/ui/types';

export default function HomePage() {
  const me = useMe();
  const today = useToday(me);
  const [day, setDay] = useState<DaySummary | null>(null);
  const [addingFood, setAddingFood] = useState(false);
  const [addingActivity, setAddingActivity] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  const load = useCallback(async () => {
    if (today) setDay(await api<DaySummary>('GET', `/api/v1/days/${today}`));
  }, [today]);
  useEffect(() => {
    load().catch(() => setError(t('errors.generic')));
  }, [load]);

  const updated = (d: DaySummary) => {
    setDay(d);
    setRefresh((n) => n + 1);
  };

  if (!me || !today) return <Spinner />;
  const dateText = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: me.profile.timeZone }).format(new Date());

  return (
    <div>
      <header className="mb-3 pr-12">
        <h1 className="text-2xl font-bold">{t('dashboard.greeting', { name: me.profile.name })}</h1>
        <p className="capitalize text-ink-muted">{dateText}</p>
      </header>
      <div className="mb-3 grid grid-cols-[1fr_auto] items-stretch gap-3">
        <HomePet refreshKey={refresh} />
        <StreakBadge refreshKey={refresh} />
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <button className="btn-primary h-14 text-base" onClick={() => setAddingFood(true)}>
          🍽️ {t('dashboard.addMeal')}
        </button>
        <button className="btn h-14 bg-expenditure text-base text-white" onClick={() => setAddingActivity(true)}>
          🏃 {t('dashboard.addActivity')}
        </button>
      </div>
      <ErrorNote message={error} />
      {!day ? (
        <Spinner />
      ) : (
        <>
          <CalorieProgress day={day} />
          <MacroBars day={day} />
          <EnergyBalanceCard day={day}>
            <DayHowCalculated day={day} me={me} />
          </EnergyBalanceCard>
        </>
      )}
      <AddFoodFlow
        key={addingFood ? 'open' : 'closed'}
        open={addingFood}
        date={today}
        foodUnit={me.profile.foodUnit}
        onClose={() => setAddingFood(false)}
        onAdded={updated}
      />
      <Sheet open={addingActivity} title={t('dashboard.addActivity')} onClose={() => setAddingActivity(false)}>
        {addingActivity && (
          <ActivityForm
            date={today}
            weightKg={day?.estimates?.inputs.weightKg ?? me.currentWeightKg}
            onSaved={(d) => {
              updated(d);
              setAddingActivity(false);
            }}
          />
        )}
      </Sheet>
    </div>
  );
}
