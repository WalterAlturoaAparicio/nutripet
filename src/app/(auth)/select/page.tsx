'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { t } from '@/i18n/es';
import { api, ClientApiError } from '@/ui/api';
import { PinPad } from '@/ui/auth/PinPad';
import { ErrorNote, Spinner } from '@/ui/kit';
import { PetAvatar } from '@/ui/pet/PetAvatar';

interface SelectorEntry {
  id: string;
  name: string;
  petStage: string | null;
  petName: string | null;
}

function SelectInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [profiles, setProfiles] = useState<SelectorEntry[] | null>(null);
  const [chosen, setChosen] = useState<SelectorEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState<number | undefined>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const status = await api<{ needsInitialSetup: boolean; deviceEnrolled: boolean }>('GET', '/api/v1/setup/status');
      if (status.needsInitialSetup) return router.replace('/onboarding');
      if (!status.deviceEnrolled) return router.replace('/enroll');
      setProfiles(await api<SelectorEntry[]>('GET', '/api/v1/profiles/selector'));
    })().catch(() => setError(t('errors.network')));
  }, [router]);

  async function submit(pin: string) {
    if (!chosen) return;
    setBusy(true);
    setError(null);
    try {
      await api('POST', '/api/v1/session', { profileId: chosen.id, pin });
      window.location.replace('/inicio');
    } catch (e) {
      if (e instanceof ClientApiError && e.body.code === 'LOCKED') setLocked(e.body.retryAfterSec);
      else setError(e instanceof ClientApiError ? e.body.message : t('errors.generic'));
    } finally {
      setBusy(false);
    }
  }

  if (!profiles) return error ? <ErrorNote message={error} /> : <Spinner />;

  return (
    <>
      <h1 className="mb-1 text-center text-2xl font-bold">{t('common.appName')}</h1>
      {params.get('expired') && <p className="mb-2 text-center text-sm text-ink-muted">{t('auth.sessionEnded')}</p>}
      {!chosen ? (
        <>
          <h2 className="mb-4 mt-4 text-center text-lg">{t('auth.whoIsIt')}</h2>
          <ul className="grid grid-cols-2 gap-3">
            {profiles.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="card flex w-full flex-col items-center gap-2 py-5"
                  onClick={() => {
                    setChosen(p);
                    setError(null);
                    setLocked(undefined);
                  }}
                >
                  <PetAvatar stage={p.petStage} size={72} />
                  <span className="text-lg font-semibold">{p.name}</span>
                  {p.petName && <span className="text-xs text-ink-muted">{p.petName}</span>}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-center text-sm text-ink-muted">
            <Link href="/onboarding" className="underline">
              {t('auth.addProfile')}
            </Link>
          </p>
        </>
      ) : (
        <>
          <button type="button" className="mb-4 self-start text-sm underline" onClick={() => setChosen(null)}>
            ← {t('common.back')}
          </button>
          <div className="mb-4 flex flex-col items-center gap-2">
            <PetAvatar stage={chosen.petStage} size={88} />
            <h2 className="text-xl font-bold">{chosen.name}</h2>
            <p className="text-ink-muted">{t('auth.enterPin')}</p>
          </div>
          <PinPad onSubmit={submit} error={error} lockedSeconds={locked} busy={busy} />
          <p className="mt-6 text-center text-sm">
            <Link href={`/recover?profile=${chosen.id}&name=${encodeURIComponent(chosen.name)}`} className="underline">
              {t('auth.forgotPin')}
            </Link>
          </p>
        </>
      )}
    </>
  );
}

export default function SelectPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <SelectInner />
    </Suspense>
  );
}
