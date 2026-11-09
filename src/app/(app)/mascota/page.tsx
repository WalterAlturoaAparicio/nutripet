'use client';

import { STAGE_THRESHOLDS } from '@/domain/config';
import { t, tList } from '@/i18n/es';
import { api } from '@/ui/api';
import { Spinner } from '@/ui/kit';
import { PetCard } from '@/ui/pet/PetCard';
import { PetSvg } from '@/ui/pet/PetSvg';
import { usePet, type PetView } from '@/ui/pet/usePet';
import type { Stage } from '@/ui/pet/geometry';

const STAGES: Stage[] = ['newborn', 'young', 'adolescent', 'adult', 'special'];

/** Pet screen (/mascota): evolution path, wardrobe, milestones and transparent XP rules (T112). */
export default function PetPage() {
  const { pet, setPet } = usePet();
  if (!pet) return <Spinner />;
  const equipped = pet.accessories.filter((a) => a.equipped).map((a) => a.id);

  async function toggle(id: string) {
    const next = equipped.includes(id) ? equipped.filter((x) => x !== id) : [...equipped, id];
    setPet(await api<PetView>('PATCH', '/api/v1/pet', { equippedAccessoryIds: next }));
  }

  return (
    <div>
      <h1 className="mb-3 pr-12 text-2xl font-bold">{t('pet.title')}</h1>
      <PetCard pet={pet} onChange={setPet} />

      <section className="card mt-4">
        <h2 className="mb-2 font-semibold">{t('pet.evolution')}</h2>
        <ol className="grid grid-cols-5 gap-1 text-center text-[11px]">
          {STAGES.map((s) => {
            const reached = pet.maxXpReached >= STAGE_THRESHOLDS[s];
            return (
              <li key={s} className={reached ? '' : 'opacity-40 grayscale'} aria-current={pet.stage === s ? 'step' : undefined}>
                <PetSvg stage={s} size={56} />
                <span className="block">{t(`pet.stages.${s}`)}</span>
                <span className="text-ink-muted">{STAGE_THRESHOLDS[s]} XP</span>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="card mt-4">
        <h2 className="mb-2 font-semibold">{t('pet.wardrobe')}</h2>
        <ul className="grid grid-cols-5 gap-2">
          {pet.accessories.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                disabled={!a.unlocked}
                aria-pressed={a.equipped}
                onClick={() => toggle(a.id)}
                className={`flex w-full flex-col items-center rounded-xl p-2 text-[11px] ${a.equipped ? 'bg-target-soft ring-2 ring-target' : 'bg-surface-sunken'} disabled:opacity-40`}
              >
                <img src={`/pet/acc-${a.id}.svg`} alt="" width={44} height={26} />
                {a.nameEs}
                <span className="text-ink-muted">{!a.unlocked ? `🔒 ${t('pet.locked')}` : a.equipped ? t('pet.unequip') : t('pet.equip')}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {pet.recentMilestones.length > 0 && (
        <section className="card mt-4">
          <h2 className="mb-2 font-semibold">{t('pet.milestones')}</h2>
          <ul className="space-y-2 text-sm">
            {pet.recentMilestones.map((m) => (
              <li key={m.id}>
                <span className="text-xs text-ink-muted">{m.unlockedAt.slice(0, 10)}</span>
                <p>{m.message.text}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <details className="card mt-4 text-sm">
        <summary className="min-h-touch cursor-pointer py-2 font-semibold">{t('pet.howXp')}</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {tList('pet.xpRules').map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
