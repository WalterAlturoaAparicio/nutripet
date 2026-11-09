'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { PetCard } from './PetCard';
import { usePet } from './usePet';

/** Compact pet on the home dashboard; keeps nutrition widgets visible (FR-077). Shows "+XP" after logging. */
export function HomePet({ refreshKey }: { refreshKey?: number }) {
  const { pet, setPet } = usePet(refreshKey);
  const prev = useRef<number | null>(null);
  const [gain, setGain] = useState<number | null>(null);

  useEffect(() => {
    if (!pet) return;
    if (prev.current !== null && pet.xpTotal > prev.current) {
      setGain(pet.xpTotal - prev.current);
      const id = window.setTimeout(() => setGain(null), 2500);
      prev.current = pet.xpTotal;
      return () => window.clearTimeout(id);
    }
    prev.current = pet.xpTotal;
  }, [pet]);

  if (!pet) return <div className="card h-[108px]" aria-busy />;
  return (
    <div className="relative">
      <Link href="/mascota" className="absolute inset-0 z-0" aria-label={pet.name} />
      <div className="pointer-events-none relative z-10">
        <PetCard pet={pet} onChange={setPet} compact />
      </div>
      {gain !== null && (
        <span className="absolute right-3 top-2 z-20 animate-bounce rounded-full bg-target px-2 py-0.5 text-xs font-bold text-white" role="status">
          +{gain} XP
        </span>
      )}
    </div>
  );
}
