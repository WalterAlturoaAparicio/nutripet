'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { t } from '@/i18n/es';
import { api, ClientApiError } from '@/ui/api';
import { ErrorNote, Field, Segmented, Spinner } from '@/ui/kit';
import { emptyNutrients, NutrientForm, nutrientPayload, type NutrientDraft } from '@/ui/foods/NutrientForm';

const CATEGORIES = [
  'cereales', 'carnes', 'pescados', 'huevos', 'lacteos', 'leguminosas', 'tuberculos_platanos', 'frutas', 'verduras',
  'grasas', 'azucares', 'bebidas', 'preparaciones', 'empacados', 'otros',
] as const;

function NewFoodInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [name, setName] = useState(params.get('name') ?? '');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('preparaciones');
  const [state, setState] = useState<'raw' | 'cooked' | 'prepared' | 'packaged'>('prepared');
  const [brand, setBrand] = useState('');
  const [productForm, setProductForm] = useState<'as_sold' | 'dry_mix' | 'concentrate'>('as_sold');
  const [instructions, setInstructions] = useState('');
  const [sourceNote, setSourceNote] = useState('');
  const [nutrients, setNutrients] = useState<NutrientDraft>(emptyNutrients());
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setError(null);
    try {
      const food = await api<{ id: string }>('POST', '/api/v1/foods', {
        nameEs: name.trim(),
        category,
        preparationState: state,
        brand: brand.trim() || null,
        productForm,
        preparationInstructions: instructions.trim() || null,
        sourceNote: sourceNote.trim(),
        aliases: params.get('name') && params.get('name') !== name.trim() ? [params.get('name')!] : [],
        ...nutrientPayload(nutrients),
      });
      const returnTo = params.get('returnTo');
      router.replace(returnTo && returnTo.startsWith('/') ? returnTo : `/alimentos/${food.id}`);
    } catch (err) {
      if (err instanceof ClientApiError && err.body.fields) setErrors(err.body.fields);
      setError(err instanceof ClientApiError ? (Object.values(err.body.fields ?? {})[0] ?? err.body.message) : t('errors.generic'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <h1 className="mb-4 text-2xl font-bold">{t('foods.newFood')}</h1>
      <section className="card mb-3">
        <Field label={t('onboarding.name')} error={errors.nameEs}>
          {(id) => <input id={id} className="input" value={name} maxLength={80} required onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label={t('foods.category')}>
          {(id) => (
            <select id={id} className="input" value={category} onChange={(e) => setCategory(e.target.value as (typeof CATEGORIES)[number])}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`foods.categories.${c}`)}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label={t('foods.preparation')}>
          {() => (
            <Segmented
              label={t('foods.preparation')}
              value={state}
              onChange={setState}
              options={(['raw', 'cooked', 'prepared', 'packaged'] as const).map((s) => ({ value: s, label: t(`foods.states.${s}`) }))}
            />
          )}
        </Field>
        <Field label={t('foods.productForm')} help={t('foods.productFormHelp')}>
          {() => (
            <Segmented
              label={t('foods.productForm')}
              value={productForm}
              onChange={setProductForm}
              options={(['as_sold', 'dry_mix', 'concentrate'] as const).map((f) => ({ value: f, label: t(`foods.productForms.${f}`) }))}
            />
          )}
        </Field>
        {productForm !== 'as_sold' && (
          <Field label={t('foods.preparationInstructions')}>
            {(id) => <input id={id} className="input" value={instructions} maxLength={300} onChange={(e) => setInstructions(e.target.value)} />}
          </Field>
        )}
        <Field label={`${t('foods.brand')} (opcional)`}>
          {(id) => <input id={id} className="input" value={brand} maxLength={60} onChange={(e) => setBrand(e.target.value)} />}
        </Field>
        <Field label={t('foods.valuesSource')} error={errors.sourceNote}>
          {(id) => (
            <input
              id={id}
              className="input"
              value={sourceNote}
              maxLength={200}
              required
              placeholder={t('foods.valuesSourcePlaceholder')}
              onChange={(e) => setSourceNote(e.target.value)}
            />
          )}
        </Field>
      </section>
      <section className="card mb-3">
        <NutrientForm value={nutrients} onChange={setNutrients} errors={errors} />
      </section>
      <ErrorNote message={error} />
      <button className="btn-primary w-full" disabled={busy}>
        {t('common.save')}
      </button>
    </form>
  );
}

export default function NewFoodPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <NewFoodInner />
    </Suspense>
  );
}
