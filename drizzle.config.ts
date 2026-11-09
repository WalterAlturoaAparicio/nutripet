import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/server/db/schema/index.ts',
  out: './src/server/db/migrations',
  dbCredentials: { url: process.env.DATABASE_PATH || './data/nutripet.db' },
});
