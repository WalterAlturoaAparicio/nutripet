'use client';

import { useEffect, useState } from 'react';
import { t } from '@/i18n/es';

/** Large-key PIN pad (4–6 digits). Calls onSubmit with the PIN; shows a countdown while locked. */
export function PinPad({
  onSubmit,
  error,
  lockedSeconds,
  busy,
}: {
  onSubmit: (pin: string) => void;
  error?: string | null;
  lockedSeconds?: number;
  busy?: boolean;
}) {
  const [pin, setPin] = useState('');
  const [remaining, setRemaining] = useState(lockedSeconds ?? 0);

  useEffect(() => {
    setRemaining(lockedSeconds ?? 0);
    if (!lockedSeconds) return;
    const timer = window.setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [lockedSeconds]);

  useEffect(() => {
    if (error) setPin('');
  }, [error]);

  const locked = remaining > 0;
  const press = (d: string) => !locked && setPin((p) => (p.length < 6 ? p + d : p));
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <div className="mx-auto w-full max-w-xs">
      <div className="mb-4 flex justify-center gap-3" aria-label={t('auth.enterPin')} aria-live="polite">
        {Array.from({ length: 6 }, (_, i) => (
          <span
            key={i}
            className={`h-4 w-4 rounded-full ${i < pin.length ? 'bg-ink' : 'bg-surface-sunken'} ${i >= 4 ? 'opacity-60' : ''}`}
          />
        ))}
      </div>
      {locked ? (
        <p role="alert" className="mb-4 text-center text-sm font-semibold text-red-700">
          {t('auth.lockedFor', { seconds: remaining })}
        </p>
      ) : (
        error && (
          <p role="alert" className="mb-4 text-center text-sm text-red-700">
            {error}
          </p>
        )
      )}
      <div className="grid grid-cols-3 gap-3">
        {keys.map((k) => (
          <button key={k} type="button" className="btn-secondary h-16 text-2xl" disabled={locked || busy} onClick={() => press(k)}>
            {k}
          </button>
        ))}
        <button
          type="button"
          className="btn-secondary h-16 text-lg"
          aria-label="Borrar"
          disabled={locked || busy}
          onClick={() => setPin((p) => p.slice(0, -1))}
        >
          ⌫
        </button>
        <button type="button" className="btn-secondary h-16 text-2xl" disabled={locked || busy} onClick={() => press('0')}>
          0
        </button>
        <button
          type="button"
          className="btn-primary h-16 text-lg"
          aria-label={t('common.confirm')}
          disabled={locked || busy || pin.length < 4}
          onClick={() => onSubmit(pin)}
        >
          ✓
        </button>
      </div>
    </div>
  );
}
