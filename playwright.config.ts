import { defineConfig } from '@playwright/test';

const PORT = 3100;
const env = {
  DATABASE_PATH: './data/e2e.db',
  SESSION_SECRET: 'e2e-session-secret-0123456789abcdef0123',
  SETUP_TOKEN: 'e2e-setup-token-0123456789abcdef0123456',
  COOKIE_SECURE: 'false',
};

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
  },
  projects: [{ name: 'mobile', use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } }],
  webServer: {
    // Fresh database each run, then the production server.
    command: `pnpm tsx tests/e2e/prepare.ts && pnpm start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/v1/setup/status`,
    reuseExistingServer: false,
    timeout: 180_000,
    env,
  },
});
