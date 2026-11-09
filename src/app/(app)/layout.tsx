import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { profileIdForSessionToken, SESSION_COOKIE } from '@/server/auth/session';
import { BottomNav } from '@/ui/nav/BottomNav';
import { IdleGuard } from '@/ui/auth/IdleGuard';
import { PwaRegister } from '@/ui/pwa/PwaRegister';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!profileIdForSessionToken(token)) redirect('/select');
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col">
      <main className="flex-1 px-4 pb-28 pt-4">{children}</main>
      <BottomNav />
      <IdleGuard />
      <PwaRegister />
    </div>
  );
}
