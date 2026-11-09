import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NutriPet',
  description: 'Tu compañero de nutrición y actividad',
  applicationName: 'NutriPet',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#fffdf8',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CO">
      <body className="min-h-dvh bg-surface text-ink antialiased">{children}</body>
    </html>
  );
}
