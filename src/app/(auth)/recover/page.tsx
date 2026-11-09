'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { t } from '@/i18n/es';
import { api, ClientApiError } from '@/ui/api';
import { ErrorNote, Field, Spinner } from '@/ui/kit';

function RecoverInner() {
  const params = useSearchParams();
  const profileId = params.get('profile') ?? '';
  const name = params.get('name') ?? '';
  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(0);
  const [newCode, setNewCode] = useState<string | null>(null);

  useEffect(() => {
    if (!locked) return;
    const timer = window.setInterval(() => setLocked((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [locked]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const r = await api<{ recoveryCode: string }>('POST', `/api/v1/profiles/${profileId}/pin-reset`, {
        recoveryCode: code,
        newPin: pin,
      });
      setNewCode(r.recoveryCode);
    } catch (err) {
      if (err instanceof ClientApiError && err.body.code === 'LOCKED') setLocked(err.body.retryAfterSec ?? 60);
      else setError(err instanceof ClientApiError ? (err.body.fields?.newPin ?? err.body.message) : t('errors.generic'));
    }
  }

  if (newCode) {
    return (
      <div className="card">
        <h1 className="mb-2 text-xl font-bold">{t('auth.newRecoveryCode')}</h1>
        <p className="my-4 rounded-xl bg-surface-sunken p-4 text-center font-mono text-2xl tracking-widest">{newCode}</p>
        <p className="mb-4 text-sm text-ink-muted">{t('auth.saveRecoveryCode')}</p>
        <Link href="/select" className="btn-primary w-full">
          {t('onboarding.done')}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card">
      <h1 className="mb-1 text-xl font-bold">{t('auth.recoverTitle')}</h1>
      <p className="mb-4 text-ink-muted">{name}</p>
      <Field label={t('auth.recoveryCode')}>
        {(id) => (
          <input
            id={id}
            className="input font-mono uppercase tracking-widest"
            autoComplete="off"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="XXXX-XXXX-XXXX"
            required
          />
        )}
      </Field>
      <Field label={t('auth.newPin')}>
        {(id) => (
          <input
            id={id}
            className="input"
            type="password"
            inputMode="numeric"
            pattern="\d{4,6}"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            required
          />
        )}
      </Field>
      {locked > 0 && <ErrorNote message={t('auth.lockedFor', { seconds: locked })} />}
      <ErrorNote message={error} />
      <button className="btn-primary w-full" disabled={locked > 0 || pin.length < 4 || !code}>
        {t('auth.resetPin')}
      </button>
      <p className="mt-4 text-center text-sm">
        <Link href="/select" className="underline">
          {t('common.back')}
        </Link>
      </p>
    </form>
  );
}

export default function RecoverPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <RecoverInner />
    </Suspense>
  );
}
