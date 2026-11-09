'use client';

import { useState } from 'react';
import { t } from '@/i18n/es';
import { api, ClientApiError } from '@/ui/api';
import { ErrorNote, Field } from '@/ui/kit';

export default function EnrollPage() {
  const [label, setLabel] = useState('');
  const [mode, setMode] = useState<'pairing' | 'token'>('pairing');
  const [secret, setSecret] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // The token is sent once to the server and never stored in the browser.
      await api('POST', '/api/v1/devices/enroll', mode === 'pairing' ? { label, pairingCode: secret } : { label, setupToken: secret });
      setSecret('');
      window.location.replace('/select');
    } catch (err) {
      setError(err instanceof ClientApiError ? err.body.message : t('errors.generic'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card">
      <h1 className="mb-2 text-xl font-bold">{t('devices.enrollTitle')}</h1>
      <p className="mb-4 text-sm text-ink-muted">{t('devices.enrollIntro')}</p>
      <Field label={t('devices.label')}>
        {(id) => (
          <input
            id={id}
            className="input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t('devices.labelPlaceholder')}
            maxLength={40}
            required
          />
        )}
      </Field>
      <Field label={mode === 'pairing' ? t('devices.pairingCode') : t('devices.setupToken')}>
        {(id) => (
          <input
            id={id}
            className={`input ${mode === 'pairing' ? 'font-mono uppercase tracking-widest' : ''}`}
            type={mode === 'token' ? 'password' : 'text'}
            autoComplete="off"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            required
          />
        )}
      </Field>
      <button
        type="button"
        className="mb-4 text-sm underline"
        onClick={() => {
          setMode((m) => (m === 'pairing' ? 'token' : 'pairing'));
          setSecret('');
        }}
      >
        {mode === 'pairing' ? t('devices.useToken') : t('devices.usePairing')}
      </button>
      <ErrorNote message={error} />
      <button className="btn-primary w-full" disabled={busy || !label || !secret}>
        {t('devices.enroll')}
      </button>
    </form>
  );
}
