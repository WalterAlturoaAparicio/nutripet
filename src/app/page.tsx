import { redirect } from 'next/navigation';

// The home dashboard lives in the (app) group at /inicio; the root only routes.
export default function RootPage() {
  redirect('/inicio');
}
