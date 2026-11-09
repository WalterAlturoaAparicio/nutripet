'use client';

import { useCallback, useEffect, useState } from 'react';
import { t } from '@/i18n/es';
import { api } from '@/ui/api';

interface DeviceEntry {
  id: string;
  label: string;
  lastSeenAt: string;
  isCurrent: boolean;
}

export function DevicesSection() {
  const [devices, setDevices] = useState<DeviceEntry[]>([]);
  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(null);

  const load = useCallback(() => api<DeviceEntry[]>('GET', '/api/v1/devices').then(setDevices), []);
  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  return (
    <section className="card mt-4">
      <h2 className="mb-2 text-lg font-semibold">{t('devices.title')}</h2>
      <ul className="mb-3 divide-y divide-black/5">
        {devices.map((d) => (
          <li key={d.id} className="flex min-h-touch items-center justify-between gap-2 py-2">
            <span>
              {d.label}
              {d.isCurrent && <span className="ml-2 text-xs text-ink-muted">({t('devices.thisDevice')})</span>}
            </span>
            {!d.isCurrent && (
              <button
                className="btn-secondary px-3 text-sm"
                onClick={async () => {
                  await api('DELETE', `/api/v1/devices/${d.id}`);
                  load();
                }}
              >
                {t('devices.revoke')}
              </button>
            )}
          </li>
        ))}
      </ul>
      {code ? (
        <div className="rounded-xl bg-surface-sunken p-3 text-center">
          <p className="font-mono text-2xl tracking-widest">{code.code}</p>
          <p className="text-xs text-ink-muted">{t('devices.codeExpires', { minutes: 10 })}</p>
        </div>
      ) : (
        <button className="btn-secondary w-full" onClick={async () => setCode(await api('POST', '/api/v1/devices/pairing-code'))}>
          {t('devices.generateCode')}
        </button>
      )}
    </section>
  );
}
