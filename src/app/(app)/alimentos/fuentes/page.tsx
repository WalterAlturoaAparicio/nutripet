import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { t } from '@/i18n/es';
import { profileIdForSessionToken, SESSION_COOKIE } from '@/server/auth/session';
import { listSources } from '@/server/modules/foods/service';

export const dynamic = 'force-dynamic';

/** Sources, licenses and required attribution (FR-028), plus the known-gaps notice (FR-029). */
export default async function SourcesPage() {
  if (!profileIdForSessionToken((await cookies()).get(SESSION_COOKIE)?.value)) redirect('/select');
  const sources = listSources().filter((s) => s.id !== 'user' && s.id !== 'user_correction');
  return (
    <div>
      <Link href="/alimentos" className="text-sm underline">
        ← {t('foods.title')}
      </Link>
      <h1 className="mb-4 mt-2 text-2xl font-bold">{t('foods.attribution')}</h1>
      <ul className="space-y-3">
        {sources.map((s) => (
          <li key={s.id} className="card text-sm">
            <h2 className="font-semibold">{s.name}</h2>
            <p className="text-ink-muted">{s.license}</p>
            <p className="mt-1">{s.attributionText}</p>
            {s.url && (
              <a className="mt-1 inline-block text-target underline" href={s.url} target="_blank" rel="noreferrer">
                {s.url}
              </a>
            )}
          </li>
        ))}
      </ul>
      <p className="card mt-4 bg-surface-sunken text-sm">{t('foods.knownGaps')}</p>
    </div>
  );
}
