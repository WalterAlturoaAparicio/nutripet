'use client';

import { useEffect, useMemo, useState } from 'react';
import { ageOn, activityMultiplier, energyProfile } from '@/domain/energy';
import { isoLocalDate } from '@/domain/dates';
import { t } from '@/i18n/es';
import { api, ClientApiError } from '@/ui/api';
import { ErrorNote, Field, Sheet, Spinner } from '@/ui/kit';
import { HowCalculated } from '@/ui/estimates/HowCalculated';
import { formatKcal } from '@/ui/format/units';
import {
  emptyDraft,
  GoalSection,
  PersonalSection,
  PreferencesSection,
  type ProfileDraft,
} from '@/ui/profile/ProfileFields';

const STEPS = ['stepPersonal', 'stepGoal', 'stepSummary', 'stepPreferences', 'stepPin'] as const;

export default function OnboardingPage() {
  const [mode, setMode] = useState<'loading' | 'initial' | 'session' | 'token'>('loading');
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<ProfileDraft>(() => ({
    ...emptyDraft(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Bogota',
  }));
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [setupToken, setSetupToken] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [error, setError] = useState<string | null>(null);
  const [caution, setCaution] = useState<string | null>(null);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const status = await api<{ needsInitialSetup: boolean }>('GET', '/api/v1/setup/status');
      if (status.needsInitialSetup) return setMode('initial');
      const me = await fetch('/api/v1/me', { cache: 'no-store' });
      setMode(me.ok ? 'session' : 'token');
    })().catch(() => setError(t('errors.network')));
  }, []);

  const set = <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const preview = useMemo(() => {
    if (!draft.birthDate || draft.heightCm === '' || draft.weightKg === '') return null;
    const today = isoLocalDate(new Date(), draft.timeZone);
    const age = ageOn(draft.birthDate, today);
    return {
      age,
      energy: energyProfile({
        formula: 'mifflin_st_jeor',
        sex: draft.sexForFormula,
        weightKg: draft.weightKg,
        heightCm: draft.heightCm,
        age,
        activityMultiplier: activityMultiplier(draft.activityLevel),
        adjustmentKcal: Number(draft.calorieAdjustmentKcal || 0),
        overrideKcal: null,
      }),
    };
  }, [draft]);

  function validateStep(): boolean {
    const e: Record<string, string> = {};
    if (step === 0) {
      if (!draft.name.trim()) e.name = 'Escribe un nombre.';
      if (!draft.birthDate) e.birthDate = 'Indica tu fecha de nacimiento.';
      if (draft.heightCm === '' || draft.heightCm < 100 || draft.heightCm > 250) e.heightCm = 'Entre 100 y 250 cm.';
      if (draft.weightKg === '' || draft.weightKg < 20 || draft.weightKg > 350) e.weightKg = 'Entre 20 y 350 kg.';
      if (draft.targetWeightKg === '' || draft.targetWeightKg < 30 || draft.targetWeightKg > 300) e.targetWeightKg = 'Entre 30 y 300 kg.';
    }
    if (step === 4) {
      if (!/^\d{4,6}$/.test(pin)) e.pin = 'El PIN debe tener entre 4 y 6 dígitos.';
      else if (pin !== pin2) e.pin2 = t('onboarding.pinMismatch');
      if (mode === 'token' && !setupToken) e.setupToken = 'Ingresa el token de configuración.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit(confirm = false) {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ recoveryCode: string }>('POST', '/api/v1/profiles', {
        name: draft.name.trim(),
        birthDate: draft.birthDate,
        sexForFormula: draft.sexForFormula,
        heightCm: Math.round(Number(draft.heightCm) * 10) / 10,
        weightKg: Math.round(Number(draft.weightKg) * 10) / 10,
        targetWeightKg: Math.round(Number(draft.targetWeightKg) * 10) / 10,
        goalType: draft.goalType,
        activityLevel: draft.activityLevel,
        calorieAdjustmentKcal: draft.goalType === 'maintenance' ? 0 : Number(draft.calorieAdjustmentKcal || 0),
        weightUnit: draft.weightUnit,
        heightUnit: draft.heightUnit,
        foodUnit: draft.foodUnit,
        timeZone: draft.timeZone,
        pin,
        ...(mode === 'token' ? { setupToken } : {}),
        ...(confirm ? { confirm: true } : {}),
      });
      setCaution(null);
      setSetupToken('');
      setRecoveryCode(r.recoveryCode);
    } catch (e) {
      if (e instanceof ClientApiError && e.body.code === 'CONFIRM_REQUIRED') setCaution(e.body.reason ?? 'target_below_safety');
      else if (e instanceof ClientApiError && e.body.fields) {
        setErrors(e.body.fields);
        setError(Object.values(e.body.fields).join(' '));
      } else setError(e instanceof ClientApiError ? e.body.message : t('errors.generic'));
    } finally {
      setBusy(false);
    }
  }

  if (mode === 'loading') return error ? <ErrorNote message={error} /> : <Spinner />;

  if (recoveryCode) {
    return (
      <div className="card">
        <h1 className="mb-2 text-xl font-bold">{t('onboarding.stepRecovery')}</h1>
        <p className="my-4 rounded-xl bg-surface-sunken p-4 text-center font-mono text-2xl tracking-widest">{recoveryCode}</p>
        <p className="mb-4 text-sm text-ink-muted">{t('auth.saveRecoveryCode')}</p>
        <button className="btn-primary w-full" onClick={() => window.location.replace('/inicio')}>
          {t('onboarding.done')}
        </button>
      </div>
    );
  }

  const next = () => validateStep() && setStep((s) => Math.min(STEPS.length - 1, s + 1));

  return (
    <div>
      <h1 className="text-2xl font-bold">{t('onboarding.welcome')}</h1>
      <p className="mb-4 text-ink-muted">{t('onboarding.intro')}</p>
      <ol className="mb-4 flex gap-1" aria-label="Pasos">
        {STEPS.map((s, i) => (
          <li key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-ink' : 'bg-surface-sunken'}`} aria-current={i === step ? 'step' : undefined}>
            <span className="sr-only">{t(`onboarding.${s}`)}</span>
          </li>
        ))}
      </ol>
      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault();
          if (step < STEPS.length - 1) next();
          else if (validateStep()) submit();
        }}
      >
        <h2 className="mb-4 text-lg font-semibold">{t(`onboarding.${STEPS[step]}`)}</h2>
        {step === 0 && <PersonalSection draft={draft} set={set} errors={errors} includeWeight />}
        {step === 1 && <GoalSection draft={draft} set={set} errors={errors} />}
        {step === 2 && preview && (
          <div>
            <p className="text-sm text-ink-muted">{t('estimates.recommended')}</p>
            <p className="text-4xl font-bold tabular-nums">
              {formatKcal(preview.energy.recommendedTargetKcal)} <span className="text-lg font-normal">kcal ({t('common.estimated')})</span>
            </p>
            <HowCalculated
              energy={preview.energy}
              inputs={{ weightKg: Number(draft.weightKg), heightCm: Number(draft.heightCm), age: preview.age, sex: draft.sexForFormula }}
              weightUnit={draft.weightUnit}
            />
          </div>
        )}
        {step === 3 && <PreferencesSection draft={draft} set={set} />}
        {step === 4 && (
          <>
            <Field label={t('onboarding.pin')} error={errors.pin}>
              {(id) => (
                <input
                  id={id}
                  className="input"
                  type="password"
                  inputMode="numeric"
                  autoComplete="new-password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                />
              )}
            </Field>
            <Field label={t('onboarding.pinRepeat')} error={errors.pin2}>
              {(id) => (
                <input
                  id={id}
                  className="input"
                  type="password"
                  inputMode="numeric"
                  autoComplete="new-password"
                  value={pin2}
                  onChange={(e) => setPin2(e.target.value.replace(/\D/g, '').slice(0, 6))}
                />
              )}
            </Field>
            {mode === 'token' && (
              <Field label={t('onboarding.setupToken')} help={t('onboarding.setupTokenHelp')} error={errors.setupToken}>
                {(id) => (
                  <input
                    id={id}
                    className="input"
                    type="password"
                    autoComplete="off"
                    value={setupToken}
                    onChange={(e) => setSetupToken(e.target.value)}
                  />
                )}
              </Field>
            )}
          </>
        )}
        <ErrorNote message={error} />
        <div className="mt-2 flex gap-2">
          {step > 0 && (
            <button type="button" className="btn-secondary flex-1" onClick={() => setStep((s) => s - 1)}>
              {t('common.back')}
            </button>
          )}
          <button className="btn-primary flex-1" disabled={busy}>
            {step < STEPS.length - 1 ? t('common.next') : t('onboarding.create')}
          </button>
        </div>
      </form>
      <Sheet open={caution !== null} title={t('caution.title')} onClose={() => setCaution(null)}>
        <p className="mb-4">{caution && t(`caution.${caution}`, { floor: 1200 })}</p>
        <div className="flex gap-2">
          <button className="btn-secondary flex-1" onClick={() => setCaution(null)}>
            {t('common.back')}
          </button>
          <button className="btn-primary flex-1" onClick={() => submit(true)} disabled={busy}>
            {t('caution.accept')}
          </button>
        </div>
      </Sheet>
    </div>
  );
}
