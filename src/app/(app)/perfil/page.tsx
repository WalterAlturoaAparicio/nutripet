'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ageOn } from '@/domain/energy';
import { t } from '@/i18n/es';
import { api, ClientApiError } from '@/ui/api';
import { ErrorNote, Field, NumberInput, Sheet, Spinner } from '@/ui/kit';
import { HowCalculated } from '@/ui/estimates/HowCalculated';
import { formatKcal } from '@/ui/format/units';
import {
  GoalSection,
  orNull,
  PersonalSection,
  PreferencesSection,
  type ProfileDraft,
} from '@/ui/profile/ProfileFields';
import { DevicesSection } from '@/ui/profile/DevicesSection';
import { PetSettings } from '@/ui/pet/PetSettings';

interface Me {
  profile: { name: string; targetWeightKg: number; weightUnit: 'kg' | 'lb'; heightUnit: 'cm' | 'ft_in'; foodUnit: 'metric' | 'imperial'; timeZone: string };
  currentWeightKg: number;
  settings: {
    effectiveFrom: string;
    birthDate: string;
    sexForFormula: ProfileDraft['sexForFormula'];
    heightCm: number;
    goalType: ProfileDraft['goalType'];
    activityLevel: ProfileDraft['activityLevel'];
    bmrFormula: 'mifflin_st_jeor' | 'harris_benedict_revised';
    calorieAdjustmentKcal: number;
    calorieTargetOverrideKcal: number | null;
    proteinTargetG: number | null;
    carbsTargetG: number | null;
    fatTargetG: number | null;
  };
  energy: {
    formula: 'mifflin_st_jeor' | 'harris_benedict_revised';
    bmrKcal: number;
    activityMultiplier: number;
    baselineTdeeKcal: number;
    adjustmentKcal: number;
    recommendedTargetKcal: number;
    activeTargetKcal: number;
    targetIsOverride: boolean;
  };
}

interface HistoryEntry {
  id: string;
  effectiveFrom: string;
  goalType: string;
  activityLevel: string;
  calorieAdjustmentKcal: number;
  calorieTargetOverrideKcal: number | null;
}

function toDraft(me: Me): ProfileDraft {
  const n = (v: number | null) => (v === null ? '' : v);
  return {
    name: me.profile.name,
    birthDate: me.settings.birthDate,
    sexForFormula: me.settings.sexForFormula,
    heightCm: me.settings.heightCm,
    weightKg: me.currentWeightKg,
    targetWeightKg: me.profile.targetWeightKg,
    goalType: me.settings.goalType,
    activityLevel: me.settings.activityLevel,
    calorieAdjustmentKcal: me.settings.calorieAdjustmentKcal,
    calorieTargetOverrideKcal: n(me.settings.calorieTargetOverrideKcal),
    proteinTargetG: n(me.settings.proteinTargetG),
    carbsTargetG: n(me.settings.carbsTargetG),
    fatTargetG: n(me.settings.fatTargetG),
    weightUnit: me.profile.weightUnit,
    heightUnit: me.profile.heightUnit,
    foodUnit: me.profile.foodUnit,
    timeZone: me.profile.timeZone,
  };
}

function buildPatch(me: Me, d: ProfileDraft): Record<string, unknown> {
  const original = toDraft(me);
  const patch: Record<string, unknown> = {};
  const keys: (keyof ProfileDraft)[] = [
    'name', 'birthDate', 'sexForFormula', 'heightCm', 'targetWeightKg', 'goalType', 'activityLevel',
    'calorieAdjustmentKcal', 'calorieTargetOverrideKcal', 'proteinTargetG', 'carbsTargetG', 'fatTargetG',
    'weightUnit', 'heightUnit', 'foodUnit', 'timeZone',
  ];
  const nullable = new Set(['calorieTargetOverrideKcal', 'proteinTargetG', 'carbsTargetG', 'fatTargetG']);
  for (const k of keys) {
    if (d[k] === original[k]) continue;
    const v = d[k];
    if (nullable.has(k)) patch[k] = orNull(v as number | '');
    else if (k === 'heightCm' || k === 'targetWeightKg') patch[k] = Math.round(Number(v) * 10) / 10;
    else if (k === 'calorieAdjustmentKcal') patch[k] = d.goalType === 'maintenance' ? 0 : Number(v || 0);
    else patch[k] = v;
  }
  return patch;
}

export default function ProfilePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [caution, setCaution] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [m, h] = await Promise.all([api<Me>('GET', '/api/v1/me'), api<HistoryEntry[]>('GET', '/api/v1/me/settings-history')]);
    setMe(m);
    setDraft(toDraft(m));
    setHistory(h);
  }, []);

  useEffect(() => {
    load().catch(() => setError(t('errors.generic')));
  }, [load]);

  const set = <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d));

  async function save(confirm = false) {
    if (!me || !draft) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    setErrors({});
    try {
      const patch = buildPatch(me, draft);
      const r = await api<Me & { appliedFrom: string | null }>('PATCH', '/api/v1/me', { ...patch, ...(confirm ? { confirm: true } : {}) });
      setCaution(null);
      setNotice(r.appliedFrom ? t('estimates.appliedFromToday') : t('profile.saved'));
      await load();
    } catch (e) {
      if (e instanceof ClientApiError && e.body.code === 'CONFIRM_REQUIRED') setCaution(e.body.reason ?? 'target_below_safety');
      else if (e instanceof ClientApiError && e.body.fields) setErrors(e.body.fields);
      else setError(e instanceof ClientApiError ? e.body.message : t('errors.generic'));
    } finally {
      setBusy(false);
    }
  }

  if (!me || !draft) return error ? <ErrorNote message={error} /> : <Spinner />;

  const age = ageOn(me.settings.birthDate, new Date().toISOString().slice(0, 10));

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">{t('profile.title')}</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <section className="card mb-4">
          <h2 className="mb-3 text-lg font-semibold">{t('profile.personal')}</h2>
          <PersonalSection draft={draft} set={set} errors={errors} includeWeight={false} />
        </section>
        <section className="card mb-4">
          <h2 className="mb-3 text-lg font-semibold">{t('profile.goals')}</h2>
          <GoalSection draft={draft} set={set} errors={errors} />
          <Field
            label={t('profile.override')}
            help={t('profile.overrideHelp', { kcal: formatKcal(me.energy.recommendedTargetKcal) })}
            error={errors.calorieTargetOverrideKcal}
          >
            {(id) => (
              <NumberInput id={id} value={draft.calorieTargetOverrideKcal} step="10" inputMode="numeric" onChange={(v) => set('calorieTargetOverrideKcal', v)} />
            )}
          </Field>
          <fieldset>
            <legend className="label">{t('profile.macros')}</legend>
            <div className="grid grid-cols-3 gap-2">
              {(['proteinTargetG', 'carbsTargetG', 'fatTargetG'] as const).map((k) => (
                <Field key={k} label={t(`dashboard.${k === 'proteinTargetG' ? 'protein' : k === 'carbsTargetG' ? 'carbs' : 'fat'}`)} error={errors[k]}>
                  {(id) => <NumberInput id={id} value={draft[k]} step="1" onChange={(v) => set(k, v)} />}
                </Field>
              ))}
            </div>
          </fieldset>
        </section>
        <section className="card mb-4">
          <h2 className="mb-3 text-lg font-semibold">{t('profile.preferences')}</h2>
          <PreferencesSection draft={draft} set={set} />
        </section>
        {notice && (
          <p role="status" className="mb-3 rounded-xl bg-intake-soft p-3 text-sm">
            {notice}
          </p>
        )}
        <ErrorNote message={error} />
        <button className="btn-primary w-full" disabled={busy}>
          {t('common.save')}
        </button>
      </form>

      <HowCalculated
        energy={me.energy}
        inputs={{ weightKg: me.currentWeightKg, heightCm: me.settings.heightCm, age, sex: me.settings.sexForFormula }}
        weightUnit={me.profile.weightUnit}
        effectiveFrom={me.settings.effectiveFrom}
      />

      <details className="card mt-4 text-sm">
        <summary className="min-h-touch cursor-pointer py-2 font-semibold">{t('profile.settingsHistory')}</summary>
        <ul className="mt-2 divide-y divide-black/5">
          {history.map((h) => (
            <li key={h.id} className="py-2">
              <span className="font-semibold">{h.effectiveFrom}</span> · {t(`onboarding.goal${h.goalType === 'gain' ? 'Gain' : h.goalType === 'loss' ? 'Loss' : 'Maintenance'}`)} ·{' '}
              {t(`activityLevels.${h.activityLevel}`)} · {h.calorieAdjustmentKcal > 0 ? '+' : ''}
              {h.calorieAdjustmentKcal} kcal
              {h.calorieTargetOverrideKcal !== null && ` · ${t('estimates.active')}: ${h.calorieTargetOverrideKcal} kcal`}
            </li>
          ))}
        </ul>
      </details>

      <PetSettings />
      <DevicesSection />

      <p className="mt-6 text-center">
        <Link href="/onboarding" className="btn-secondary">
          {t('auth.addProfile')}
        </Link>
      </p>

      <Sheet open={caution !== null} title={t('caution.title')} onClose={() => setCaution(null)}>
        <p className="mb-4">{caution && t(`caution.${caution}`, { floor: 1200 })}</p>
        <div className="flex gap-2">
          <button className="btn-secondary flex-1" onClick={() => setCaution(null)}>
            {t('common.back')}
          </button>
          <button className="btn-primary flex-1" onClick={() => save(true)} disabled={busy}>
            {t('caution.accept')}
          </button>
        </div>
      </Sheet>
    </div>
  );
}
