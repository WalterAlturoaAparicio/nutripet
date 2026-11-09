'use client';

import { useEffect, useState } from 'react';
import { isoLocalDate } from '@/domain/dates';
import { api } from '@/ui/api';
import type { MeLite } from '@/ui/types';

/** The signed-in profile (cached per page load). */
export function useMe(): MeLite | null {
  const [me, setMe] = useState<MeLite | null>(null);
  useEffect(() => {
    api<MeLite>('GET', '/api/v1/me').then(setMe).catch(() => undefined);
  }, []);
  return me;
}

/** Today in the profile's time zone (FR-007). */
export function useToday(me: MeLite | null): string | null {
  return me ? isoLocalDate(new Date(), me.profile.timeZone) : null;
}
