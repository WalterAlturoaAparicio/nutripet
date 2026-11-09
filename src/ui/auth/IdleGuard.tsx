'use client';

import { useEffect } from 'react';
import { api } from '@/ui/api';

const IDLE_MS = 15 * 60 * 1000;

/** Returns to the profile selector after 15 minutes without interaction, or when the session has expired. */
export function IdleGuard() {
  useEffect(() => {
    let last = Date.now();
    const touch = () => {
      last = Date.now();
    };
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const;
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));

    const timer = window.setInterval(() => {
      if (Date.now() - last > IDLE_MS) window.location.replace('/select?expired=1');
    }, 30_000);

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - last > IDLE_MS) {
        window.location.replace('/select?expired=1');
        return;
      }
      // api() redirects to the selector if the server session is gone.
      api('GET', '/api/v1/me').catch(() => undefined);
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      events.forEach((e) => window.removeEventListener(e, touch));
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return null;
}
