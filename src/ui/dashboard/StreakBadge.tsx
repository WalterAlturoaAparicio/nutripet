'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { t } from '@/i18n/es';
import { api } from '@/ui/api';

/** Current streak on the home dashboard (T100). */
export function StreakBadge({ refreshKey }: { refreshKey?: number }) {
  const [s, setS] = useState<{ current: number; freezesAvailable: number } | null>(null);
  useEffect(() => {
    api<{ current: number; freezesAvailable: number }>('GET', '/api/v1/streak').then(setS).catch(() => undefined);
  }, [refreshKey]);
  return (
    <Link href="/calendario" className="card flex min-w-[88px] flex-col items-center justify-center text-center">
      <span aria-hidden className="text-2xl">
        🔥
      </span>
      <span className="text-xl font-bold">{s?.current ?? '–'}</span>
      <span className="text-[11px] text-ink-muted">{t('dashboard.streak')}</span>
      {s && s.freezesAvailable > 0 && <span className="text-[11px]">❄️ {s.freezesAvailable}</span>}
    </Link>
  );
}
