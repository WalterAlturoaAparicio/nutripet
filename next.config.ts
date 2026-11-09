import type { NextConfig } from 'next';
import withSerwistInit from '@serwist/next';

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  // The service worker only matters for the installed PWA; skip it in development.
  disable: process.env.NODE_ENV !== 'production',
  register: false,
});

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['better-sqlite3', '@node-rs/argon2'],
  typedRoutes: false,
};

export default withSerwist(nextConfig);
