'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { t } from '@/i18n/es';
import { api } from '@/ui/api';

const TABS = [
  { href: '/inicio', key: 'nav.home', icon: '🏠' },
  { href: '/diario', key: 'nav.journal', icon: '🍽️' },
  { href: '/actividad', key: 'nav.activity', icon: '🏃' },
  { href: '/calendario', key: 'nav.calendar', icon: '📅' },
  { href: '/progreso', key: 'nav.progress', icon: '📈' },
];

const MENU = [
  { href: '/alimentos', key: 'nav.foods' },
  { href: '/mascota', key: 'nav.pet' },
  { href: '/perfil', key: 'nav.profile' },
];

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function switchProfile() {
    await api('DELETE', '/api/v1/session').catch(() => undefined);
    // Full navigation discards every client cache of the previous profile (FR-005).
    window.location.replace('/select');
  }

  return (
    <>
      <div className="fixed right-3 top-3 z-30">
        <button
          type="button"
          aria-label={t('nav.menu')}
          aria-expanded={open}
          className="btn-secondary h-11 w-11 rounded-full px-0 shadow"
          onClick={() => setOpen((o) => !o)}
        >
          ☰
        </button>
        {open && (
          <div className="card absolute right-0 mt-2 w-52 p-2" role="menu">
            {MENU.map((m) => (
              <button
                key={m.href}
                role="menuitem"
                className="block min-h-touch w-full rounded-lg px-3 text-left hover:bg-surface-sunken"
                onClick={() => {
                  setOpen(false);
                  router.push(m.href);
                }}
              >
                {t(m.key)}
              </button>
            ))}
            <button
              role="menuitem"
              className="block min-h-touch w-full rounded-lg px-3 text-left font-semibold text-target hover:bg-surface-sunken"
              onClick={switchProfile}
            >
              {t('nav.switchProfile')}
            </button>
          </div>
        )}
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-black/5 bg-surface-raised/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <ul className="mx-auto grid max-w-xl grid-cols-5">
          {TABS.map((tab) => {
            const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-[56px] flex-col items-center justify-center text-xs ${active ? 'font-bold text-ink' : 'text-ink-muted'}`}
                >
                  <span aria-hidden className="text-lg">
                    {tab.icon}
                  </span>
                  {t(tab.key)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
