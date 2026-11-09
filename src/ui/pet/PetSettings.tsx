'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { t } from '@/i18n/es';
import { api, ClientApiError } from '@/ui/api';
import { ErrorNote, Field } from '@/ui/kit';
import { PetSvg } from './PetSvg';
import { usePet, type PetView } from './usePet';

/** Pet name/configuration section of the profile screen (T112). */
export function PetSettings() {
  const { pet, setPet } = usePet();
  const [name, setName] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (pet) setName(pet.name);
  }, [pet]);
  if (!pet) return null;
  return (
    <section className="card mt-4">
      <h2 className="mb-2 text-lg font-semibold">{t('pet.title')}</h2>
      <div className="flex items-center gap-3">
        <PetSvg stage={pet.stage} accessories={pet.accessories.filter((a) => a.equipped).map((a) => a.id)} size={72} />
        <form
          className="flex-1"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            try {
              setPet(await api<PetView>('PATCH', '/api/v1/pet', { name: name.trim() }));
              setMsg(t('profile.saved'));
            } catch (err) {
              setError(err instanceof ClientApiError ? (Object.values(err.body.fields ?? {})[0] ?? err.body.message) : t('errors.generic'));
            }
          }}
        >
          <Field label={t('pet.name')}>
            {(id) => <input id={id} className="input" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} />}
          </Field>
          <button className="btn-secondary w-full" disabled={!name.trim() || name.trim() === pet.name}>
            {t('common.save')}
          </button>
        </form>
      </div>
      {msg && <p className="mt-2 text-sm">{msg}</p>}
      <ErrorNote message={error} />
      <Link href="/mascota" className="mt-2 inline-block text-sm underline">
        {t('pet.wardrobe')} →
      </Link>
    </section>
  );
}
