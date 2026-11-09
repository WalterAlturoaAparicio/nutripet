'use client';

import { useEffect } from 'react';

/** Registers the service worker only in secure contexts (HTTPS or localhost); LAN HTTP works without it. */
export function PwaRegister() {
  useEffect(() => {
    if (!window.isSecureContext || !('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }, []);
  return null;
}
