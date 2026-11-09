'use client';

import { useEffect, useRef, useState } from 'react';
import { t } from '@/i18n/es';
import { api, ClientApiError } from '@/ui/api';
import { PetSvg } from './PetSvg';
import type { PetView } from './usePet';

export function MilestoneToast({ text, onDone }: { text: string; onDone: () => void }) {
  useEffect(() => {
    const id = window.setTimeout(onDone, 5000);
    return () => window.clearTimeout(id);
  }, [onDone]);
  return (
    <div role="status" className="fixed inset-x-4 top-4 z-50 mx-auto max-w-md rounded-2xl bg-ink p-4 text-white shadow-lg">
      🎉 {text}
    </div>
  );
}

/** Pet with mood, goal-specific message, XP progress and feeding (T111). `compact` for the home dashboard. */
export function PetCard({ pet, onChange, compact }: { pet: PetView; onChange: (p: PetView) => void; compact?: boolean }) {
  const [bounce, setBounce] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const seen = useRef<Set<string>>(new Set(pet.recentMilestones.map((m) => m.id)));

  useEffect(() => {
    const fresh = pet.recentMilestones.find((m) => !seen.current.has(m.id));
    pet.recentMilestones.forEach((m) => seen.current.add(m.id));
    if (fresh) setToast(fresh.message.text);
  }, [pet.recentMilestones]);

  async function feed() {
    setNote(null);
    try {
      const p = await api<PetView>('POST', '/api/v1/pet/feed');
      onChange(p);
      setBounce(false);
      requestAnimationFrame(() => setBounce(true));
    } catch (e) {
      setNote(e instanceof ClientApiError ? e.body.message : t('errors.generic'));
    }
  }

  const equipped = pet.accessories.filter((a) => a.equipped).map((a) => a.id);
  const toNext = pet.nextStageXp === null ? null : pet.nextStageXp - pet.maxXpReached;

  return (
    <section className={`card ${compact ? 'flex items-center gap-3' : 'text-center'}`} aria-label={t('pet.title')}>
      <div className={compact ? 'shrink-0' : 'flex justify-center'} onAnimationEnd={() => setBounce(false)}>
        <PetSvg stage={pet.stage} accessories={equipped} size={compact ? 76 : 200} bounce={bounce} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`font-bold ${compact ? '' : 'text-xl'}`}>
          {pet.name} <span className="text-xs font-normal text-ink-muted">· {t(`pet.moods.${pet.moodLabel}`)}</span>
        </p>
        <p className={`text-sm ${compact ? 'line-clamp-2' : 'my-2'}`}>{pet.message.text}</p>
        <div className="mt-1" aria-label={t('pet.xp', { xp: pet.xpTotal })}>
          <div className="h-2 rounded-full bg-surface-sunken" role="progressbar" aria-valuenow={pet.progressPct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-2 rounded-full bg-target" style={{ width: `${pet.progressPct}%` }} />
          </div>
          <p className="mt-0.5 text-[11px] text-ink-muted">
            {t(`pet.stages.${pet.stage}`)} · {toNext === null ? t('pet.maxStage') : t('pet.toNext', { xp: toNext })}
          </p>
        </div>
        {!compact && (
          <div className="mt-3 flex items-center justify-center gap-3">
            <span className="text-sm">{t('pet.treats', { count: pet.treats })}</span>
            <button className="btn-primary" disabled={pet.treats === 0} onClick={feed}>
              🐟 {t('pet.feed')}
            </button>
          </div>
        )}
        {!compact && pet.treats === 0 && <p className="mt-1 text-xs text-ink-muted">{t('pet.noTreats')}</p>}
        {note && <p className="mt-1 text-xs text-red-700">{note}</p>}
      </div>
      {toast && <MilestoneToast text={toast} onDone={() => setToast(null)} />}
    </section>
  );
}
