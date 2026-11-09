'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/ui/api';
import type { Stage } from './geometry';

export interface PetView {
  name: string;
  stage: Stage;
  xpTotal: number;
  maxXpReached: number;
  nextStageXp: number | null;
  progressPct: number;
  mood: number;
  moodLabel: 'happy' | 'content' | 'sleepy';
  treats: number;
  message: { key: string; text: string };
  accessories: { id: string; nameEs: string; unlocked: boolean; equipped: boolean }[];
  recentMilestones: { id: string; unlockedAt: string; message: { key: string; text: string } }[];
}

export function usePet(refreshKey?: number) {
  const [pet, setPet] = useState<PetView | null>(null);
  const load = useCallback(() => api<PetView>('GET', '/api/v1/pet').then(setPet), []);
  useEffect(() => {
    load().catch(() => undefined);
  }, [load, refreshKey]);
  return { pet, setPet, reload: load };
}
