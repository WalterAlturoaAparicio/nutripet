'use client';

import { useEffect, useId, useRef } from 'react';
import { t } from '@/i18n/es';

export function Field({
  label,
  error,
  help,
  children,
}: {
  label: string;
  error?: string;
  help?: string;
  children: (id: string) => React.ReactNode;
}) {
  const id = useId();
  return (
    <div className="mb-4">
      <label htmlFor={id} className="label">
        {label}
      </label>
      {children(id)}
      {help && !error && <p className="mt-1 text-xs text-ink-faint">{help}</p>}
      {error && (
        <p role="alert" className="mt-1 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`btn min-h-touch rounded-xl px-4 text-sm ${value === o.value ? 'bg-ink text-white' : 'bg-surface-sunken text-ink'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Bottom sheet dialog, mobile-first. */
export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-surface-raised p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] outline-none sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" className="btn-secondary h-11 w-11 px-0" aria-label={t('common.close')} onClick={onClose}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ErrorNote({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="my-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">
      {message}
    </p>
  );
}

export function Spinner() {
  return <p className="py-8 text-center text-ink-muted">{t('common.loading')}</p>;
}

export function NumberInput({
  id,
  value,
  onChange,
  step = 'any',
  min,
  max,
  inputMode = 'decimal',
  ...rest
}: {
  id?: string;
  value: number | '';
  onChange: (v: number | '') => void;
  step?: string | number;
  min?: number;
  max?: number;
  inputMode?: 'decimal' | 'numeric';
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return (
    <input
      id={id}
      type="number"
      inputMode={inputMode}
      className="input"
      value={value}
      step={step}
      min={min}
      max={max}
      onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      {...rest}
    />
  );
}
